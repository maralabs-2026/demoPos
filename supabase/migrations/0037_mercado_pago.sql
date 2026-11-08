-- Bloque 3.5a: base del cobro con QR de Mercado Pago.
--
-- mp_puntos: cada QR impreso, atado a una caja física de Mercado Pago. Los ven todos los roles del
-- comercio y los administra el dueño.
-- mp_cobros: un intento de cobro y su estado. Nadie los escribe directo: el servidor los crea por
-- rpc y solo la service role (webhook o consulta a Mercado Pago) aplica el resultado. Un QR fijo
-- atiende de a una orden, así que hay un solo cobro pendiente por punto.

create table public.mp_puntos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  external_pos_id text not null check (external_pos_id ~ '^[A-Za-z0-9]{1,40}$'),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, comercio_id),
  unique (comercio_id, external_pos_id)
);

create unique index mp_puntos_comercio_nombre_key
  on public.mp_puntos (comercio_id, lower(btrim(nombre)));

alter table public.mp_puntos enable row level security;

revoke all on public.mp_puntos from public, anon, authenticated;
grant select on public.mp_puntos to authenticated;
grant insert (comercio_id, nombre, external_pos_id) on public.mp_puntos to authenticated;
grant update (nombre, external_pos_id, activo, updated_at) on public.mp_puntos to authenticated;

create policy mp_puntos_select on public.mp_puntos for select to authenticated
  using (comercio_id = public.current_comercio_id());
create policy mp_puntos_insert on public.mp_puntos for insert to authenticated
  with check (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno');
create policy mp_puntos_update on public.mp_puntos for update to authenticated
  using (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno')
  with check (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno');

create table public.mp_cobros (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  punto_id uuid not null,
  creado_por uuid not null references public.perfiles (id),
  monto numeric(12,2) not null check (monto > 0),
  order_id text unique,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'cancelado', 'expirado', 'reintegrado', 'error')),
  monto_pagado numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (punto_id, comercio_id) references public.mp_puntos (id, comercio_id)
);

create unique index mp_cobros_punto_pendiente_key
  on public.mp_cobros (punto_id) where estado = 'pendiente';
create index mp_cobros_comercio_fecha_idx on public.mp_cobros (comercio_id, created_at desc);

alter table public.mp_cobros enable row level security;

revoke all on public.mp_cobros from public, anon, authenticated;
grant select on public.mp_cobros to authenticated;

-- El cajero solo sigue sus propios cobros.
create policy mp_cobros_select on public.mp_cobros for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and (creado_por = auth.uid() or public.current_rol() in ('dueno', 'encargado'))
  );

create function public.crear_mp_cobro(p_punto_id uuid, p_monto numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comercio uuid := public.current_comercio_id();
  v_id uuid;
begin
  if v_comercio is null or public.current_rol() is null then
    raise exception 'Sin permiso' using errcode = 'PV020';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto <> round(p_monto, 2) then
    raise exception 'Monto inválido' using errcode = 'PV031';
  end if;
  if not exists (
    select 1 from mp_puntos where id = p_punto_id and comercio_id = v_comercio and activo
  ) then
    raise exception 'Punto de cobro inválido' using errcode = 'PV029';
  end if;

  -- La orden vence a los 15 minutos en Mercado Pago: un pendiente más viejo ya no ocupa el QR.
  update mp_cobros set estado = 'expirado', updated_at = now()
   where punto_id = p_punto_id and estado = 'pendiente'
     and created_at < now() - interval '20 minutes';

  begin
    insert into mp_cobros (comercio_id, punto_id, creado_por, monto)
    values (v_comercio, p_punto_id, auth.uid(), p_monto)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'El QR tiene un cobro en curso' using errcode = 'PV030';
  end;

  return v_id;
end
$$;

create function public.fijar_orden_mp_cobro(p_cobro_id uuid, p_order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update mp_cobros set order_id = p_order_id, updated_at = now()
   where id = p_cobro_id and creado_por = auth.uid() and estado = 'pendiente' and order_id is null;
  if not found then
    raise exception 'Cobro inválido' using errcode = 'PV031';
  end if;
end
$$;

create function public.cancelar_mp_cobro(p_cobro_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update mp_cobros set estado = 'cancelado', updated_at = now()
   where id = p_cobro_id
     and comercio_id = public.current_comercio_id()
     and estado = 'pendiente'
     and (creado_por = auth.uid() or public.current_rol() in ('dueno', 'encargado'));
  if not found then
    raise exception 'Cobro inválido' using errcode = 'PV031';
  end if;
end
$$;

-- Solo service role. Recibe lo que Mercado Pago informó al consultar la orden; devuelve el estado
-- que quedó, o null si el cobro no existe. Un pago aprobado manda sobre un cobro cancelado o vencido
-- en el sistema, porque la plata entró igual. Si lo pagado no coincide, queda en error.
create function public.aplicar_estado_mp_cobro(
  p_cobro_id uuid,
  p_order_id text,
  p_estado text,
  p_monto_pagado numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v mp_cobros;
  v_nuevo text := p_estado;
begin
  if p_estado not in ('aprobado', 'cancelado', 'expirado', 'reintegrado') then
    raise exception 'Estado inválido' using errcode = 'PV031';
  end if;

  select * into v from mp_cobros where id = p_cobro_id for update;
  if not found then
    return null;
  end if;
  if v.order_id is not null and v.order_id <> p_order_id then
    return v.estado;
  end if;

  if p_estado = 'aprobado' and p_monto_pagado is distinct from v.monto then
    v_nuevo := 'error';
  end if;

  if not (
    v.estado = 'pendiente'
    or (v.estado in ('cancelado', 'expirado') and v_nuevo in ('aprobado', 'error'))
    or (v.estado = 'aprobado' and v_nuevo = 'reintegrado')
  ) then
    return v.estado;
  end if;

  update mp_cobros
     set estado = v_nuevo,
         order_id = p_order_id,
         monto_pagado = coalesce(p_monto_pagado, monto_pagado),
         updated_at = now()
   where id = p_cobro_id;
  return v_nuevo;
end
$$;

revoke execute on function public.crear_mp_cobro(uuid, numeric) from public, anon;
revoke execute on function public.fijar_orden_mp_cobro(uuid, text) from public, anon;
revoke execute on function public.cancelar_mp_cobro(uuid) from public, anon;
revoke execute on function public.aplicar_estado_mp_cobro(uuid, text, text, numeric)
  from public, anon, authenticated;

grant execute on function public.crear_mp_cobro(uuid, numeric) to authenticated;
grant execute on function public.fijar_orden_mp_cobro(uuid, text) to authenticated;
grant execute on function public.cancelar_mp_cobro(uuid) to authenticated;
grant execute on function public.aplicar_estado_mp_cobro(uuid, text, text, numeric) to service_role;
