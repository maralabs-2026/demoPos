-- Verificación de transferencias: el dueño o el encargado dejan constancia de si la plata de un
-- pago por transferencia llegó a la cuenta. El sistema sabe que la venta se cobró con ese medio,
-- pero no si la transferencia existió: eso se controla mirando la cuenta.
--
-- Verificar es solo dejar constancia: no cambia la venta, el stock ni la caja, y "no llegó" no
-- anula nada (la mercadería ya se entregó). Nada se edita ni se borra: cada marca es una fila
-- nueva y el estado del pago es la última. Un error se corrige marcando el estado contrario.
--
--   PV034 el pago no existe, no es de una transferencia o su venta está anulada
--   PV035 el estado no es válido

alter table public.venta_pagos
  add constraint venta_pagos_id_comercio_key unique (id, comercio_id);

create table public.pago_verificaciones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  venta_pago_id uuid not null,
  estado text not null check (estado in ('llego', 'no_llego')),
  usuario_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (venta_pago_id, comercio_id) references public.venta_pagos (id, comercio_id),
  foreign key (usuario_id, comercio_id) references public.perfiles (id, comercio_id)
);

create index pago_verificaciones_pago_idx
  on public.pago_verificaciones (venta_pago_id, created_at desc);

alter table public.pago_verificaciones enable row level security;

-- Solo lectura y solo para dueño y encargado: la escribe verificar_pago. El cajero no la ve,
-- porque es el control sobre su propio turno.
grant select on public.pago_verificaciones to authenticated;

create policy pago_verificaciones_select on public.pago_verificaciones for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

create function public.verificar_pago(p_venta_pago_id uuid, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_id uuid;
  v_at timestamptz;
begin
  if v_uid is null or v_comercio is null or public.current_rol() is null
     or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede verificar transferencias' using errcode = '42501';
  end if;

  if p_estado is null or p_estado not in ('llego', 'no_llego') then
    raise exception 'El estado no es válido' using errcode = 'PV035';
  end if;

  -- Bloquea el pago: dos marcas simultáneas quedan en orden.
  perform 1
    from public.venta_pagos p
    join public.ventas v on v.id = p.venta_id and v.comercio_id = p.comercio_id
    join public.medios_pago m on m.id = p.medio_pago_id and m.comercio_id = p.comercio_id
   where p.id = p_venta_pago_id
     and p.comercio_id = v_comercio
     and m.tipo = 'transferencia'
     and v.estado = 'completada'
     for update of p;
  if not found then
    raise exception 'El pago no existe, no es una transferencia o su venta está anulada'
      using errcode = 'PV034';
  end if;

  insert into public.pago_verificaciones (comercio_id, venta_pago_id, estado, usuario_id)
  values (v_comercio, p_venta_pago_id, p_estado, v_uid)
  returning id, created_at into v_id, v_at;

  return jsonb_build_object(
    'verificacion_id', v_id,
    'venta_pago_id', p_venta_pago_id,
    'estado', p_estado,
    'created_at', v_at
  );
end
$$;
revoke execute on function public.verificar_pago(uuid, text) from public, anon;
grant execute on function public.verificar_pago(uuid, text) to authenticated;

notify pgrst, 'reload schema';
