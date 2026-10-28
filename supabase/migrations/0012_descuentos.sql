-- Fase 4c: descuentos por ítem y sobre el total, según el rol.
--
-- Reglas (CLAUDE.md, Fase 4): dueño y encargado descuentan sin límite; el cajero, hasta un
-- porcentaje que define el dueño en configuracion (clave descuento_max_cajero_pct, 10 por
-- defecto). El cliente manda porcentajes; los montos se calculan acá y quedan como snapshot en
-- la venta (venta_items.descuento y ventas.descuento), igual que los precios.
--
-- Montos:
--   descuento del ítem  = round(precio * cantidad * pct_item / 100, 2)
--   subtotal del ítem   = precio * cantidad - descuento del ítem
--   descuento del total = round(suma de subtotales * pct_total / 100, 2)
--   total               = suma de subtotales - descuento del total   (tiene que ser > 0)
--
-- Error nuevo: PV011 descuento mayor al permitido para el rol (DETAIL = el tope en %).

alter table public.venta_items
  add column descuento numeric(12, 2) not null default 0 check (descuento >= 0);

alter table public.ventas
  add column descuento numeric(12, 2) not null default 0 check (descuento >= 0);

insert into public.configuracion (comercio_id, clave, valor)
select id, 'descuento_max_cajero_pct', '10'::jsonb from public.comercios
on conflict (comercio_id, clave) do nothing;

drop function public.registrar_venta(uuid, jsonb, jsonb);

create function public.registrar_venta(
  p_caja_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_descuento_pct numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid;
  v_rol public.rol_usuario;
  v_max_pct numeric;
  v_pct_total numeric := coalesce(p_descuento_pct, 0);
  v_venta_id uuid;
  v_created timestamptz;
  v_neto numeric(12, 2) := 0;
  v_desc_total numeric(12, 2);
  v_total numeric(12, 2);
  v_desc_item numeric(12, 2);
  v_pagado numeric(12, 2) := 0;
  v_vuelto_total numeric(12, 2) := 0;
  v_vuelto numeric(12, 2);
  v_recibido numeric(12, 2);
  v_item record;
  v_prod record;
  v_pago record;
  v_medio record;
begin
  if v_uid is null then
    raise exception 'Se requiere iniciar sesión' using errcode = '28000';
  end if;

  select comercio_id, rol into v_comercio, v_rol
    from public.perfiles where id = v_uid and activo;
  if v_comercio is null then
    raise exception 'Perfil inexistente o inactivo' using errcode = '42501';
  end if;

  -- Tope de descuento del rol. Sin la clave cargada, el cajero queda en 10 %.
  if v_rol = 'cajero' then
    select (valor #>> '{}')::numeric into v_max_pct
      from public.configuracion
     where comercio_id = v_comercio and clave = 'descuento_max_cajero_pct';
    v_max_pct := coalesce(v_max_pct, 10);
  else
    v_max_pct := 100;
  end if;

  if v_pct_total < 0 or v_pct_total > 100 then
    raise exception 'Descuento inválido' using errcode = 'PV004';
  end if;
  if v_pct_total > v_max_pct then
    raise exception 'Descuento sobre el total mayor al permitido (máximo % %%)', v_max_pct
      using errcode = 'PV011', detail = v_max_pct::text;
  end if;

  perform 1 from public.cajas
   where id = p_caja_id
     and comercio_id = v_comercio
     and usuario_id = v_uid
     and estado = 'abierta'
     for share;
  if not found then
    raise exception 'La caja no existe, no es tuya o está cerrada' using errcode = 'PV002';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene ítems' using errcode = 'PV004';
  end if;
  if jsonb_typeof(p_pagos) is distinct from 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene pagos' using errcode = 'PV004';
  end if;

  -- Pasada 1: bloquear productos en orden de id (sin deadlocks), validar stock y descuentos,
  -- y calcular el neto con los precios vigentes.
  for v_item in
    select x.producto_id,
           sum(x.cantidad)::integer as cantidad,
           max(x.pct) as pct,
           count(distinct x.pct) as pcts
      from (
        select (e ->> 'producto_id')::uuid as producto_id,
               (e ->> 'cantidad')::integer as cantidad,
               coalesce(nullif(e ->> 'descuento_pct', '')::numeric, 0) as pct
          from jsonb_array_elements(p_items) e
      ) x
     group by 1
     order by 1
  loop
    if v_item.cantidad is null or v_item.cantidad <= 0 then
      raise exception 'Cantidad inválida' using errcode = 'PV004';
    end if;
    if v_item.pcts > 1 or v_item.pct < 0 or v_item.pct > 100 then
      raise exception 'Descuento inválido' using errcode = 'PV004';
    end if;
    if v_item.pct > v_max_pct then
      raise exception 'Descuento de un producto mayor al permitido (máximo % %%)', v_max_pct
        using errcode = 'PV011', detail = v_max_pct::text;
    end if;

    select id, nombre, precio, stock_actual into v_prod
      from public.productos
     where id = v_item.producto_id and comercio_id = v_comercio
       for update;
    if not found then
      raise exception 'Un producto de la venta no existe' using errcode = 'PV005';
    end if;

    if v_prod.stock_actual < v_item.cantidad then
      raise exception 'Stock insuficiente de "%": quedan %, se pidieron %',
        v_prod.nombre, v_prod.stock_actual, v_item.cantidad
        using errcode = 'PV001', detail = v_prod.id::text;
    end if;

    v_desc_item := round(v_prod.precio * v_item.cantidad * v_item.pct / 100, 2);
    v_neto := v_neto + v_prod.precio * v_item.cantidad - v_desc_item;
  end loop;

  v_desc_total := round(v_neto * v_pct_total / 100, 2);
  v_total := v_neto - v_desc_total;
  if v_total <= 0 then
    raise exception 'El total de la venta debe ser mayor a cero' using errcode = 'PV004';
  end if;

  insert into public.ventas (comercio_id, caja_id, usuario_id, total, descuento)
  values (v_comercio, p_caja_id, v_uid, v_total, v_desc_total)
  returning id, created_at into v_venta_id, v_created;

  -- Pasada 2: ítems (snapshot de nombre, precio y descuento) y movimientos de stock. Los
  -- productos siguen bloqueados por esta transacción, así que el precio no pudo cambiar.
  for v_item in
    select x.producto_id,
           sum(x.cantidad)::integer as cantidad,
           max(x.pct) as pct
      from (
        select (e ->> 'producto_id')::uuid as producto_id,
               (e ->> 'cantidad')::integer as cantidad,
               coalesce(nullif(e ->> 'descuento_pct', '')::numeric, 0) as pct
          from jsonb_array_elements(p_items) e
      ) x
     group by 1
     order by 1
  loop
    select id, nombre, precio into v_prod
      from public.productos where id = v_item.producto_id and comercio_id = v_comercio;

    v_desc_item := round(v_prod.precio * v_item.cantidad * v_item.pct / 100, 2);

    insert into public.venta_items
      (comercio_id, venta_id, producto_id, nombre, precio_unitario, cantidad, descuento,
       subtotal)
    values
      (v_comercio, v_venta_id, v_prod.id, v_prod.nombre, v_prod.precio, v_item.cantidad,
       v_desc_item, v_prod.precio * v_item.cantidad - v_desc_item);

    insert into public.movimientos_stock
      (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id)
    values
      (v_comercio, v_prod.id, 'venta', -v_item.cantidad, v_venta_id, v_uid);
  end loop;

  -- Pagos: igual que en 0007. Varios medios; el efectivo puede traer `recibido` y genera vuelto.
  for v_pago in
    select (e ->> 'medio_pago_id')::uuid as medio_pago_id,
           (e ->> 'monto')::numeric(12, 2) as monto,
           nullif(e ->> 'recibido', '')::numeric(12, 2) as recibido,
           nullif(e ->> 'referencia_externa', '') as referencia_externa
      from jsonb_array_elements(p_pagos) e
  loop
    if v_pago.monto is null or v_pago.monto <= 0 then
      raise exception 'Monto de pago inválido' using errcode = 'PV004';
    end if;

    select id, tipo into v_medio
      from public.medios_pago
     where id = v_pago.medio_pago_id and comercio_id = v_comercio and activo;
    if not found then
      raise exception 'Medio de pago inválido' using errcode = 'PV003';
    end if;

    v_recibido := null;
    v_vuelto := 0;
    if v_medio.tipo = 'efectivo' then
      v_recibido := coalesce(v_pago.recibido, v_pago.monto);
      if v_recibido < v_pago.monto then
        raise exception 'El monto recibido es menor al monto a cobrar' using errcode = 'PV003';
      end if;
      v_vuelto := v_recibido - v_pago.monto;
    elsif v_pago.recibido is not null and v_pago.recibido <> v_pago.monto then
      raise exception 'Este medio de pago cobra el monto exacto' using errcode = 'PV004';
    end if;

    insert into public.venta_pagos
      (comercio_id, venta_id, medio_pago_id, monto, recibido, vuelto, referencia_externa)
    values
      (v_comercio, v_venta_id, v_medio.id, v_pago.monto, v_recibido, v_vuelto,
       v_pago.referencia_externa);

    v_pagado := v_pagado + v_pago.monto;
    v_vuelto_total := v_vuelto_total + v_vuelto;
  end loop;

  if v_pagado <> v_total then
    raise exception 'Los pagos (%) no coinciden con el total (%)', v_pagado, v_total
      using errcode = 'PV003';
  end if;

  return jsonb_build_object(
    'venta_id', v_venta_id,
    'total', v_total,
    'descuento', v_desc_total,
    'vuelto', v_vuelto_total,
    'created_at', v_created
  );
end
$$;

revoke execute on function public.registrar_venta(uuid, jsonb, jsonb, numeric) from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb, jsonb, numeric) to authenticated;
