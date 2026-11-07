-- Bloque 3.2a: ventas cobradas sin internet que se envían cuando vuelve la conexión.
--
-- Reglas aprobadas por el dueño (ver CLAUDE.md):
--   - Se registra lo que se cobró: precio, promo y descuentos del momento de la venta, que manda el
--     dispositivo. No se recalculan con el catálogo actual.
--   - Si no alcanza el stock, la venta entra igual y el stock queda negativo: la mercadería ya se
--     entregó. Es la única forma de bajar el stock de cero.
--   - Se acepta cualquier medio de pago del comercio, aunque se haya desactivado después.
-- Las ventas sin conexión quedan marcadas, con avisos ('precio' si algún precio no coincide con el
-- catálogo al sincronizar, 'stock' si dejó stock negativo) para que el dueño las revise.
--
-- Cada venta trae su propio id, generado en el dispositivo: reenviarla (se cortó la red en la
-- respuesta) devuelve la misma venta en vez de duplicarla.
--
--   PV024 la hora de la venta está fuera del turno de la caja
--   PV025 el id de la venta ya lo usa otra venta

alter table public.ventas
  add column sin_conexion boolean not null default false,
  add column sincronizada_at timestamptz,
  add column avisos_sin_conexion text[] not null default '{}'
    check (avisos_sin_conexion <@ array['precio', 'stock']::text[]),
  add constraint ventas_sin_conexion_sincronizada
    check (sin_conexion = (sincronizada_at is not null));

-- El stock ya no tiene un CHECK fijo: lo controla el trigger, que deja bajar de cero solo a una
-- venta sin conexión. Subir el stock siempre se puede, aunque siga negativo.
alter table public.productos drop constraint productos_stock_actual_check;

create or replace function public.aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock integer;
begin
  update public.productos
     set stock_actual = stock_actual + new.cantidad
   where id = new.producto_id
     and comercio_id = new.comercio_id
  returning stock_actual into v_stock;

  if new.cantidad < 0 and v_stock < 0 and not (
    new.tipo = 'venta' and exists (
      select 1 from public.ventas v where v.id = new.venta_id and v.sin_conexion
    )
  ) then
    -- Mismo código que el CHECK anterior: las acciones ya lo traducen a "no alcanza el stock".
    raise exception 'El stock de un producto no puede quedar negativo' using errcode = '23514';
  end if;
  return new;
end
$$;

create function public.registrar_venta_sin_conexion(
  p_venta_id uuid,
  p_caja_id uuid,
  p_fecha timestamptz,
  p_items jsonb,
  p_pagos jsonb,
  p_descuento numeric default 0
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
  v_abierta_at timestamptz;
  v_existente public.ventas;
  v_fecha timestamptz;
  v_item record;
  v_prod record;
  v_bruto numeric(12, 2);
  v_neto numeric(12, 2) := 0;
  v_desc_total numeric(12, 2) := coalesce(p_descuento, 0);
  v_total numeric(12, 2);
  v_avisos text[] := '{}';
  v_lineas jsonb := '[]'::jsonb;
  v_linea jsonb;
  v_pago record;
  v_medio record;
  v_recibido numeric(12, 2);
  v_vuelto numeric(12, 2);
  v_pagado numeric(12, 2) := 0;
  v_vuelto_total numeric(12, 2) := 0;
begin
  if v_uid is null then
    raise exception 'Se requiere iniciar sesión' using errcode = '28000';
  end if;
  select comercio_id, rol into v_comercio, v_rol
    from public.perfiles where id = v_uid and activo;
  if v_comercio is null then
    raise exception 'Perfil inexistente o inactivo' using errcode = '42501';
  end if;
  if p_venta_id is null then
    raise exception 'La venta no tiene id' using errcode = 'PV004';
  end if;

  if v_rol = 'cajero' then
    select (valor #>> '{}')::numeric into v_max_pct
      from public.configuracion
     where comercio_id = v_comercio and clave = 'descuento_max_cajero_pct';
    v_max_pct := coalesce(v_max_pct, 10);
  else
    v_max_pct := 100;
  end if;

  select abierta_at into v_abierta_at
    from public.cajas
   where id = p_caja_id and comercio_id = v_comercio and usuario_id = v_uid and estado = 'abierta'
     for share;
  if not found then
    -- Puede ser un reenvío de una venta que ya entró antes de cerrar la caja.
    select * into v_existente from public.ventas where id = p_venta_id;
    if found and v_existente.comercio_id = v_comercio and v_existente.usuario_id = v_uid then
      return jsonb_build_object(
        'venta_id', v_existente.id, 'total', v_existente.total,
        'descuento', v_existente.descuento, 'created_at', v_existente.created_at,
        'avisos', to_jsonb(v_existente.avisos_sin_conexion), 'repetida', true);
    end if;
    raise exception 'La caja no existe, no es tuya o está cerrada' using errcode = 'PV002';
  end if;

  -- Unos minutos de tolerancia: el reloj del dispositivo puede no coincidir con el del servidor.
  if p_fecha is null
     or p_fecha < v_abierta_at - interval '5 minutes'
     or p_fecha > now() + interval '5 minutes' then
    raise exception 'La hora de la venta está fuera del turno de la caja' using errcode = 'PV024';
  end if;
  v_fecha := least(greatest(p_fecha, v_abierta_at), now());

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene ítems' using errcode = 'PV004';
  end if;
  if jsonb_typeof(p_pagos) is distinct from 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene pagos' using errcode = 'PV004';
  end if;

  -- Ítems: se bloquean los productos en orden de id (igual que registrar_venta) y se validan las
  -- cuentas de cada línea. Un producto aparece una sola vez.
  for v_item in
    select (e ->> 'producto_id')::uuid as producto_id,
           (e ->> 'cantidad')::integer as cantidad,
           (e ->> 'precio_unitario')::numeric(12, 2) as precio,
           coalesce(nullif(e ->> 'descuento', '')::numeric(12, 2), 0) as descuento,
           coalesce(nullif(e ->> 'promocion_descuento', '')::numeric(12, 2), 0) as promo_desc,
           nullif(btrim(e ->> 'promocion_nombre'), '') as promo_nombre,
           count(*) over (partition by e ->> 'producto_id') as repeticiones
      from jsonb_array_elements(p_items) e
     order by 1
  loop
    if v_item.repeticiones > 1 then
      raise exception 'Un producto aparece dos veces en la venta' using errcode = 'PV004';
    end if;
    if v_item.cantidad is null or v_item.cantidad <= 0
       or v_item.precio is null or v_item.precio < 0 then
      raise exception 'Cantidad o precio inválido' using errcode = 'PV004';
    end if;
    v_bruto := v_item.precio * v_item.cantidad;
    if v_item.promo_desc < 0 or v_item.promo_desc > v_bruto
       or v_item.descuento < v_item.promo_desc or v_item.descuento > v_bruto then
      raise exception 'Descuento inválido' using errcode = 'PV004';
    end if;
    -- El descuento manual (lo que no es promo) respeta el tope del rol, igual que al vender online.
    if v_item.descuento - v_item.promo_desc
       > round((v_bruto - v_item.promo_desc) * v_max_pct / 100, 2) then
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

    if v_prod.precio <> v_item.precio and not ('precio' = any (v_avisos)) then
      v_avisos := v_avisos || 'precio'::text;
    end if;
    if v_prod.stock_actual < v_item.cantidad and not ('stock' = any (v_avisos)) then
      v_avisos := v_avisos || 'stock'::text;
    end if;

    v_neto := v_neto + v_bruto - v_item.descuento;
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod.id, 'nombre', v_prod.nombre, 'precio', v_item.precio,
      'cantidad', v_item.cantidad, 'descuento', v_item.descuento,
      'promo_nombre', case when v_item.promo_desc > 0 then v_item.promo_nombre end,
      'promo_descuento', v_item.promo_desc));
  end loop;

  -- Con los productos bloqueados, un reenvío simultáneo ya terminó: si la venta existe, se
  -- devuelve la misma.
  select * into v_existente from public.ventas where id = p_venta_id;
  if found then
    if v_existente.comercio_id = v_comercio and v_existente.usuario_id = v_uid then
      return jsonb_build_object(
        'venta_id', v_existente.id, 'total', v_existente.total,
        'descuento', v_existente.descuento, 'created_at', v_existente.created_at,
        'avisos', to_jsonb(v_existente.avisos_sin_conexion), 'repetida', true);
    end if;
    raise exception 'El id de la venta ya está en uso' using errcode = 'PV025';
  end if;

  if v_desc_total < 0 or v_desc_total > v_neto
     or v_desc_total > round(v_neto * v_max_pct / 100, 2) then
    raise exception 'Descuento sobre el total mayor al permitido (máximo % %%)', v_max_pct
      using errcode = 'PV011', detail = v_max_pct::text;
  end if;
  v_total := v_neto - v_desc_total;
  if v_total <= 0 then
    raise exception 'El total de la venta debe ser mayor a cero' using errcode = 'PV004';
  end if;

  insert into public.ventas
    (id, comercio_id, caja_id, usuario_id, total, descuento, created_at,
     sin_conexion, sincronizada_at, avisos_sin_conexion)
  values
    (p_venta_id, v_comercio, p_caja_id, v_uid, v_total, v_desc_total, v_fecha,
     true, now(), v_avisos);

  for v_linea in select value from jsonb_array_elements(v_lineas) loop
    insert into public.venta_items
      (comercio_id, venta_id, producto_id, nombre, precio_unitario, cantidad,
       descuento, promocion_nombre, promocion_descuento, subtotal)
    values
      (v_comercio, p_venta_id,
       (v_linea ->> 'producto_id')::uuid,
       v_linea ->> 'nombre',
       (v_linea ->> 'precio')::numeric,
       (v_linea ->> 'cantidad')::integer,
       (v_linea ->> 'descuento')::numeric,
       v_linea ->> 'promo_nombre',
       (v_linea ->> 'promo_descuento')::numeric,
       (v_linea ->> 'precio')::numeric * (v_linea ->> 'cantidad')::integer
         - (v_linea ->> 'descuento')::numeric);

    insert into public.movimientos_stock
      (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id, created_at)
    values
      (v_comercio, (v_linea ->> 'producto_id')::uuid, 'venta',
       -((v_linea ->> 'cantidad')::integer), p_venta_id, v_uid, v_fecha);
  end loop;

  -- Pagos: mismas reglas que registrar_venta, pero vale un medio que se desactivó después de cobrar.
  for v_pago in
    select (e ->> 'medio_pago_id')::uuid as medio_pago_id,
           (e ->> 'monto')::numeric(12, 2) as monto,
           nullif(e ->> 'recibido', '')::numeric(12, 2) as recibido
      from jsonb_array_elements(p_pagos) e
  loop
    if v_pago.monto is null or v_pago.monto <= 0 then
      raise exception 'Monto de pago inválido' using errcode = 'PV004';
    end if;
    select id, tipo into v_medio
      from public.medios_pago
     where id = v_pago.medio_pago_id and comercio_id = v_comercio;
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
      (comercio_id, venta_id, medio_pago_id, monto, recibido, vuelto)
    values
      (v_comercio, p_venta_id, v_medio.id, v_pago.monto, v_recibido, v_vuelto);

    v_pagado := v_pagado + v_pago.monto;
    v_vuelto_total := v_vuelto_total + v_vuelto;
  end loop;

  if v_pagado <> v_total then
    raise exception 'Los pagos (%) no coinciden con el total (%)', v_pagado, v_total
      using errcode = 'PV003';
  end if;

  return jsonb_build_object(
    'venta_id', p_venta_id,
    'total', v_total,
    'descuento', v_desc_total,
    'vuelto', v_vuelto_total,
    'created_at', v_fecha,
    'avisos', to_jsonb(v_avisos),
    'repetida', false
  );
end
$$;

revoke execute on function public.registrar_venta_sin_conexion(uuid, uuid, timestamptz, jsonb, jsonb, numeric)
  from public, anon;
grant execute on function public.registrar_venta_sin_conexion(uuid, uuid, timestamptz, jsonb, jsonb, numeric)
  to authenticated;
