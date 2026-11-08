-- Bloque 3.5b: une el cobro con QR con su venta y agrega la confirmación a mano.
--
-- El vínculo lo hace un trigger sobre venta_pagos, dentro de la misma transacción de registrar_venta:
-- si el pago trae el id de una orden de Mercado Pago, esa orden tiene que estar cobrada, por el mismo
-- monto y sin venta. Así una orden no se usa dos veces ni se cierra una venta con una orden sin pagar.
-- Confirmar a mano no prueba el pago: la venta queda con qr_manual para que la revise el dueño.

alter table public.mp_cobros drop constraint mp_cobros_estado_check;
alter table public.mp_cobros
  add constraint mp_cobros_estado_check check (estado in (
    'pendiente', 'aprobado', 'cancelado', 'expirado', 'reintegrado', 'error', 'confirmado_manual'
  )),
  add column venta_id uuid unique,
  add column confirmado_por uuid references public.perfiles (id),
  add constraint mp_cobros_venta_comercio_fkey
    foreign key (venta_id, comercio_id) references public.ventas (id, comercio_id);

alter table public.ventas add column qr_manual boolean not null default false;

alter table public.ventas drop constraint ventas_revisada_solo_sin_conexion;
alter table public.ventas add constraint ventas_revisada_solo_a_revisar
  check (revisada_at is null or sin_conexion or qr_manual);

create index ventas_qr_manual_a_revisar_idx on public.ventas (comercio_id, created_at desc)
  where qr_manual and revisada_at is null;

create function public.confirmar_mp_cobro_manual(p_cobro_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order text;
begin
  update public.mp_cobros
     set estado = 'confirmado_manual', confirmado_por = auth.uid(), updated_at = now()
   where id = p_cobro_id
     and comercio_id = public.current_comercio_id()
     and estado = 'pendiente'
     and order_id is not null
     and (creado_por = auth.uid() or public.current_rol() in ('dueno', 'encargado'))
  returning order_id into v_order;
  if not found then
    raise exception 'Cobro inválido' using errcode = 'PV031';
  end if;
  return v_order;
end
$$;

revoke execute on function public.confirmar_mp_cobro_manual(uuid) from public, anon;
grant execute on function public.confirmar_mp_cobro_manual(uuid) to authenticated;

-- Igual que en 0037, y además un aviso real de Mercado Pago actualiza una confirmación a mano.
create or replace function public.aplicar_estado_mp_cobro(
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
    or (v.estado in ('cancelado', 'expirado', 'confirmado_manual') and v_nuevo in ('aprobado', 'error'))
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

create function public.vincular_mp_cobro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.mp_cobros;
begin
  select * into v
    from public.mp_cobros
   where order_id = new.referencia_externa and comercio_id = new.comercio_id
     for update;
  if not found then
    return new;
  end if;

  if v.estado not in ('aprobado', 'confirmado_manual')
     or v.venta_id is not null
     or v.monto <> new.monto then
    raise exception 'El cobro con QR no se puede usar en esta venta' using errcode = 'PV032';
  end if;

  update public.mp_cobros set venta_id = new.venta_id, updated_at = now() where id = v.id;
  if v.estado = 'confirmado_manual' then
    update public.ventas set qr_manual = true where id = new.venta_id;
  end if;
  return new;
end
$$;

revoke execute on function public.vincular_mp_cobro() from public, anon, authenticated;

create trigger venta_pagos_vincular_mp_cobro
  after insert on public.venta_pagos
  for each row
  when (new.referencia_externa is not null)
  execute function public.vincular_mp_cobro();

create or replace function public.marcar_venta_revisada(p_venta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_venta public.ventas;
begin
  if v_uid is null or v_comercio is null or public.current_rol() is null
     or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede revisar ventas' using errcode = '42501';
  end if;

  select * into v_venta
    from public.ventas
   where id = p_venta_id and comercio_id = v_comercio
     for update;
  if not found or not (v_venta.sin_conexion or v_venta.qr_manual) then
    raise exception 'La venta no existe o no tiene nada para revisar' using errcode = 'PV026';
  end if;

  if v_venta.revisada_at is null then
    update public.ventas
       set revisada_at = now(), revisada_por = v_uid
     where id = p_venta_id
    returning * into v_venta;
  end if;

  return jsonb_build_object(
    'venta_id', v_venta.id,
    'revisada_at', v_venta.revisada_at,
    'revisada_por', v_venta.revisada_por
  );
end
$$;
