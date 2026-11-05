-- Fase 5c: gastos del comercio, fijos y variables, pagados o por pagar. Solo dueño y encargado.
--
-- Un gasto se paga con una caja abierta (genera un retiro en esa caja, en la misma transacción) o
-- por fuera de la caja (no toca el arqueo). Pagar con la caja no es obligatorio aunque haya una
-- abierta: el dueño puede pagar con transferencia.
--
-- Un gasto no se borra ni se edita: se anula. Si salió de una caja todavía abierta, anularlo devuelve
-- la plata con un ingreso. Si esa caja ya se cerró, su arqueo no se toca.
--
-- Fijo o variable es una clasificación: no genera gastos recurrentes.
--
--   42501 sin permiso    PV002 caja inexistente o ajena    PV012 caja ya cerrada
--   PV016 gasto inválido o inexistente    PV017 el gasto ya está pagado o anulado

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  descripcion text not null check (char_length(btrim(descripcion)) between 1 and 150),
  tipo text not null check (tipo in ('fijo', 'variable')),
  monto numeric(12, 2) not null check (monto > 0),
  vencimiento date,
  estado text not null default 'por_pagar' check (estado in ('por_pagar', 'pagado', 'anulado')),
  usuario_id uuid not null,
  pagado_at timestamptz,
  pagado_por uuid,
  caja_id uuid,
  caja_movimiento_id uuid references public.caja_movimientos (id),
  anulado_at timestamptz,
  anulado_por uuid,
  created_at timestamptz not null default now(),
  foreign key (usuario_id, comercio_id) references public.perfiles (id, comercio_id),
  foreign key (pagado_por, comercio_id) references public.perfiles (id, comercio_id),
  foreign key (anulado_por, comercio_id) references public.perfiles (id, comercio_id),
  foreign key (caja_id, comercio_id) references public.cajas (id, comercio_id),
  check (estado <> 'pagado' or (pagado_at is not null and pagado_por is not null)),
  check ((estado = 'anulado') = (anulado_at is not null and anulado_por is not null)),
  check ((caja_id is null) = (caja_movimiento_id is null))
);

create index gastos_comercio_estado_idx on public.gastos (comercio_id, estado, created_at desc);

alter table public.gastos enable row level security;

-- Solo lectura: se escribe con las funciones de abajo. El cajero no accede a la tabla.
grant select on public.gastos to authenticated;

create policy gastos_select on public.gastos for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

create function public.gasto_validar_rol()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'No tenés permiso para operar gastos' using errcode = '42501';
  end if;
end
$$;

revoke execute on function public.gasto_validar_rol() from public, anon, authenticated;

-- p_caja_id null: pagado por fuera de la caja. Si la caja falla, el gasto sigue por pagar.
create function public.pagar_gasto(p_gasto_id uuid, p_caja_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto public.gastos;
  v_movimiento uuid;
begin
  perform public.gasto_validar_rol();

  select * into v_gasto from public.gastos
   where id = p_gasto_id and comercio_id = public.current_comercio_id()
     for update;
  if v_gasto.id is null then
    raise exception 'El gasto no existe' using errcode = 'PV016';
  end if;
  if v_gasto.estado <> 'por_pagar' then
    raise exception 'El gasto ya está pagado o anulado' using errcode = 'PV017';
  end if;

  if p_caja_id is not null then
    v_movimiento := public.registrar_movimiento_caja(
      p_caja_id, 'retiro', v_gasto.monto, 'Gasto: ' || v_gasto.descripcion
    );
  end if;

  update public.gastos
     set estado = 'pagado', pagado_at = now(), pagado_por = auth.uid(),
         caja_id = p_caja_id, caja_movimiento_id = v_movimiento
   where id = p_gasto_id;
end
$$;

create function public.registrar_gasto(
  p_descripcion text,
  p_tipo text,
  p_monto numeric,
  p_vencimiento date,
  p_pagado boolean,
  p_caja_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_descripcion text := btrim(p_descripcion);
  v_id uuid;
begin
  perform public.gasto_validar_rol();

  if v_descripcion is null or char_length(v_descripcion) not between 1 and 150
     or p_tipo is null or p_tipo not in ('fijo', 'variable')
     or p_monto is null or p_monto <= 0 or p_monto > 9999999999.99 or p_monto <> round(p_monto, 2)
     or p_pagado is null
     or (not p_pagado and p_caja_id is not null) then
    raise exception 'El gasto no es válido' using errcode = 'PV016';
  end if;

  insert into public.gastos (comercio_id, descripcion, tipo, monto, vencimiento, usuario_id)
  values (public.current_comercio_id(), v_descripcion, p_tipo, p_monto, p_vencimiento, auth.uid())
  returning id into v_id;

  if p_pagado then
    perform public.pagar_gasto(v_id, p_caja_id);
  end if;

  return v_id;
end
$$;

-- Devuelve true si la plata volvió a la caja con un ingreso.
create function public.anular_gasto(p_gasto_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto public.gastos;
  v_estado_caja text;
  v_devuelto boolean := false;
begin
  perform public.gasto_validar_rol();

  select * into v_gasto from public.gastos
   where id = p_gasto_id and comercio_id = public.current_comercio_id()
     for update;
  if v_gasto.id is null then
    raise exception 'El gasto no existe' using errcode = 'PV016';
  end if;
  if v_gasto.estado = 'anulado' then
    raise exception 'El gasto ya está anulado' using errcode = 'PV017';
  end if;

  if v_gasto.caja_id is not null then
    -- FOR SHARE: el cierre espera a este ingreso, o este ve la caja ya cerrada.
    select estado into v_estado_caja from public.cajas where id = v_gasto.caja_id for share;
    if v_estado_caja = 'abierta' then
      perform public.registrar_movimiento_caja(
        v_gasto.caja_id, 'ingreso', v_gasto.monto, 'Gasto anulado: ' || v_gasto.descripcion
      );
      v_devuelto := true;
    end if;
  end if;

  update public.gastos
     set estado = 'anulado', anulado_at = now(), anulado_por = auth.uid()
   where id = p_gasto_id;

  return v_devuelto;
end
$$;

revoke execute on function public.pagar_gasto(uuid, uuid) from public, anon;
revoke execute on function public.registrar_gasto(text, text, numeric, date, boolean, uuid)
  from public, anon;
revoke execute on function public.anular_gasto(uuid) from public, anon;
grant execute on function public.pagar_gasto(uuid, uuid) to authenticated;
grant execute on function public.registrar_gasto(text, text, numeric, date, boolean, uuid)
  to authenticated;
grant execute on function public.anular_gasto(uuid) to authenticated;

notify pgrst, 'reload schema';
