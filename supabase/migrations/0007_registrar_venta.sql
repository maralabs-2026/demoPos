-- Fase 1: cierre de venta transaccional. Cabecera + ítems + pagos + movimientos de stock, o nada.
--
-- registrar_venta(p_caja_id, p_items, p_pagos)
--   p_items: [{"producto_id": uuid, "cantidad": int}, ...]
--   p_pagos: [{"medio_pago_id": uuid, "monto": num, "recibido"?: num, "referencia_externa"?: text}, ...]
-- Precios y total se toman de la base (nunca del cliente). Devuelve
-- {venta_id, total, vuelto, created_at}.
--
-- Errores de negocio (SQLSTATE propios, para que la app los distinga):
--   PV001 stock insuficiente     PV002 caja inválida o cerrada    PV003 pago inválido o no cubre el total
--   PV004 datos inválidos        PV005 producto inexistente
--
-- Concurrencia: los productos se bloquean con FOR UPDATE en orden de id (sin deadlocks entre
-- ventas con productos cruzados). Si dos cajeros venden la última unidad a la vez, el segundo
-- espera, ve el stock ya descontado y falla con PV001 sin dejar rastro.

create function public.registrar_venta(p_caja_id uuid, p_items jsonb, p_pagos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid;
  v_venta_id uuid;
  v_created timestamptz;
  v_total numeric(12, 2) := 0;
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

  select comercio_id into v_comercio
    from public.perfiles where id = v_uid and activo;
  if v_comercio is null then
    raise exception 'Perfil inexistente o inactivo' using errcode = '42501';
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

  -- Pasada 1: bloquear productos, validar stock y calcular el total con los precios vigentes.
  for v_item in
    select (e ->> 'producto_id')::uuid as producto_id,
           sum((e ->> 'cantidad')::integer)::integer as cantidad
      from jsonb_array_elements(p_items) e
     group by 1
     order by 1
  loop
    if v_item.cantidad is null or v_item.cantidad <= 0 then
      raise exception 'Cantidad inválida' using errcode = 'PV004';
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

    v_total := v_total + v_prod.precio * v_item.cantidad;
  end loop;

  if v_total <= 0 then
    raise exception 'El total de la venta debe ser mayor a cero' using errcode = 'PV004';
  end if;

  insert into public.ventas (comercio_id, caja_id, usuario_id, total)
  values (v_comercio, p_caja_id, v_uid, v_total)
  returning id, created_at into v_venta_id, v_created;

  -- Pasada 2: ítems (con snapshot de nombre y precio) y movimientos de stock. Los productos
  -- ya están bloqueados por esta transacción, así que el precio no pudo cambiar.
  for v_item in
    select (e ->> 'producto_id')::uuid as producto_id,
           sum((e ->> 'cantidad')::integer)::integer as cantidad
      from jsonb_array_elements(p_items) e
     group by 1
     order by 1
  loop
    select id, nombre, precio into v_prod
      from public.productos where id = v_item.producto_id and comercio_id = v_comercio;

    insert into public.venta_items
      (comercio_id, venta_id, producto_id, nombre, precio_unitario, cantidad, subtotal)
    values
      (v_comercio, v_venta_id, v_prod.id, v_prod.nombre, v_prod.precio, v_item.cantidad,
       v_prod.precio * v_item.cantidad);

    insert into public.movimientos_stock
      (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id)
    values
      (v_comercio, v_prod.id, 'venta', -v_item.cantidad, v_venta_id, v_uid);
  end loop;

  -- Pagos: soporta varios medios en una misma venta. El efectivo puede traer `recibido`
  -- mayor al monto y genera vuelto; el resto de los medios cobra exactamente el monto.
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
    'vuelto', v_vuelto_total,
    'created_at', v_created
  );
end
$$;

revoke execute on function public.registrar_venta(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb, jsonb) to authenticated;
