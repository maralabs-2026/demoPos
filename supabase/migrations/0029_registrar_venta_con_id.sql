-- Bloque 3.2b: registrar_venta acepta el id de la venta, generado en el dispositivo.
--
-- Si la red se corta mientras se cobra online, la venta puede haber entrado sin que llegue la
-- respuesta. La pantalla la reenvía entonces por registrar_venta_sin_conexion (0028) con el mismo
-- id, que devuelve la venta existente en vez de duplicarla. Sin p_venta_id, todo sigue igual.
-- El resto de la función es la de 0015, sin cambios.

drop function public.registrar_venta(uuid, jsonb, jsonb, numeric);

create function public.registrar_venta(
  p_caja_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_descuento_pct numeric default 0,
  p_venta_id uuid default null
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
  v_ahora timestamp := now() at time zone 'America/Argentina/Cordoba';
  v_dow smallint := extract(dow from v_ahora)::smallint;
  v_hora time := date_trunc('second', v_ahora)::time;
  v_venta_id uuid;
  v_created timestamptz;
  v_neto numeric(12, 2) := 0;
  v_desc_total numeric(12, 2);
  v_total numeric(12, 2);
  v_lineas jsonb := '[]'::jsonb;
  v_pagado numeric(12, 2) := 0;
  v_vuelto_total numeric(12, 2) := 0;
  v_vuelto numeric(12, 2);
  v_recibido numeric(12, 2);
  v_item record;
  v_prod record;
  v_combo record;
  v_ci record;
  -- Líneas del ticket, en orden de producto_id. Cada arreglo es una columna.
  v_ids uuid[] := '{}';
  v_nombres_prod text[] := '{}';
  v_precios numeric[] := '{}';
  v_categorias uuid[] := '{}';
  v_cantidades integer[] := '{}';
  v_pcts numeric[] := '{}';
  v_consumidos integer[] := '{}';
  v_combo_descs numeric[] := '{}';
  v_combo_nombres text[] := '{}';
  v_i integer;
  v_promo public.promociones;
  v_promo_mejor public.promociones;
  v_promo_d numeric(12, 2);
  v_promo_mejor_d numeric(12, 2);
  v_k integer;
  v_n integer;
  v_completo boolean;
  v_bruto_unit numeric;
  v_desc_unit numeric;
  v_resto numeric;
  v_bruto_resto numeric;
  v_bruto_linea numeric;
  v_share numeric;
  v_restante integer;
  v_bruto numeric(12, 2);
  v_manual numeric(12, 2);
  v_desc_item numeric(12, 2);
  v_nombres text;
  v_linea jsonb;
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
   where id = p_caja_id and comercio_id = v_comercio and usuario_id = v_uid and estado = 'abierta'
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

  -- Paso 1: bloquear productos, validar y guardar las líneas.
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

    select id, nombre, precio, stock_actual, categoria_id into v_prod
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

    v_ids := array_append(v_ids, v_prod.id);
    v_nombres_prod := array_append(v_nombres_prod, v_prod.nombre);
    v_precios := array_append(v_precios, v_prod.precio);
    v_categorias := array_append(v_categorias, v_prod.categoria_id);
    v_cantidades := array_append(v_cantidades, v_item.cantidad);
    v_pcts := array_append(v_pcts, v_item.pct);
    v_consumidos := array_append(v_consumidos, 0);
    v_combo_descs := array_append(v_combo_descs, 0::numeric);
    v_combo_nombres := array_append(v_combo_nombres, ''::text);
  end loop;

  -- Paso 2: combos, por orden de creación. Cada combo toma todas las veces que entre completo
  -- con las unidades que todavía no usó otro combo.
  for v_combo in
    select c.id, c.nombre, c.precio
      from public.combos c
     where c.comercio_id = v_comercio
       and c.activa
       and (v_dow = any (c.dias))
       and v_hora between c.desde and c.hasta
     order by c.created_at, c.id
  loop
    v_n := 0;
    v_k := null;
    v_bruto_unit := 0;
    v_completo := true;
    for v_ci in
      select ci.producto_id, ci.cantidad
        from public.combo_items ci
       where ci.combo_id = v_combo.id
    loop
      v_i := array_position(v_ids, v_ci.producto_id);
      if v_i is null then
        v_completo := false;
        exit;
      end if;
      v_n := v_n + 1;
      v_k := least(v_k, (v_cantidades[v_i] - v_consumidos[v_i]) / v_ci.cantidad);
      v_bruto_unit := v_bruto_unit + v_precios[v_i] * v_ci.cantidad;
    end loop;

    if not v_completo or v_n < 2 then
      continue;
    end if;
    v_desc_unit := v_bruto_unit - v_combo.precio;
    if v_k <= 0 or v_desc_unit <= 0 then
      continue;
    end if;

    -- Reparto por producto_id: cada línea recibe su parte de lo que queda por repartir. La pantalla
    -- hace lo mismo (aplicarCombos en promociones/logica.ts).
    v_resto := v_desc_unit * v_k;
    v_bruto_resto := v_bruto_unit * v_k;
    for v_ci in
      select ci.producto_id, ci.cantidad
        from public.combo_items ci
       where ci.combo_id = v_combo.id
       order by ci.producto_id
    loop
      v_i := array_position(v_ids, v_ci.producto_id);
      v_bruto_linea := v_precios[v_i] * v_ci.cantidad * v_k;
      v_share := case when v_bruto_resto > 0
        then round(v_resto * v_bruto_linea / v_bruto_resto, 2)
        else 0
      end;
      v_resto := v_resto - v_share;
      v_bruto_resto := v_bruto_resto - v_bruto_linea;

      v_consumidos[v_i] := v_consumidos[v_i] + v_ci.cantidad * v_k;
      v_combo_descs[v_i] := v_combo_descs[v_i] + v_share;
      v_combo_nombres[v_i] := case when v_combo_nombres[v_i] = '' then v_combo.nombre
        else v_combo_nombres[v_i] || ' + ' || v_combo.nombre end;
    end loop;
  end loop;

  -- Paso 3: por línea, promo sobre las unidades libres del combo; después el manual.
  for v_i in 1 .. array_length(v_ids, 1) loop
    v_restante := v_cantidades[v_i] - v_consumidos[v_i];
    v_promo_mejor_d := 0;
    v_promo_mejor := null;

    if v_restante > 0 then
      for v_promo in
        select * from public.promociones p
         where p.comercio_id = v_comercio
           and p.activa
           and (v_dow = any (p.dias))
           and v_hora between p.desde and p.hasta
           and ((p.alcance = 'producto' and p.producto_id = v_ids[v_i])
             or (p.alcance = 'categoria' and p.categoria_id = v_categorias[v_i]))
         -- En un empate gana la promo más antigua: la pantalla usa el mismo orden.
         order by p.created_at, p.id
      loop
        v_promo_d := public.descuento_promocion(v_promo, v_precios[v_i], v_restante);
        if v_promo_d > v_promo_mejor_d then
          v_promo_mejor_d := v_promo_d;
          v_promo_mejor := v_promo;
        end if;
      end loop;
    end if;

    v_bruto := v_precios[v_i] * v_cantidades[v_i];
    v_manual := round((v_bruto - v_combo_descs[v_i] - v_promo_mejor_d) * v_pcts[v_i] / 100, 2);
    v_desc_item := v_combo_descs[v_i] + v_promo_mejor_d + v_manual;
    v_neto := v_neto + v_bruto - v_desc_item;

    v_nombres := v_combo_nombres[v_i];
    if v_promo_mejor_d > 0 then
      v_nombres := case when v_nombres = '' then v_promo_mejor.nombre
        else v_nombres || ' + ' || v_promo_mejor.nombre end;
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'producto_id', v_ids[v_i],
      'nombre', v_nombres_prod[v_i],
      'precio', v_precios[v_i],
      'cantidad', v_cantidades[v_i],
      'promo_nombre', case when v_combo_descs[v_i] + v_promo_mejor_d > 0 then v_nombres end,
      'promo_descuento', v_combo_descs[v_i] + v_promo_mejor_d,
      'descuento', v_desc_item
    ));
  end loop;

  v_desc_total := round(v_neto * v_pct_total / 100, 2);
  v_total := v_neto - v_desc_total;
  if v_total <= 0 then
    raise exception 'El total de la venta debe ser mayor a cero' using errcode = 'PV004';
  end if;

  -- Con p_venta_id, el id lo pone el dispositivo: si la respuesta se pierde, la misma venta se
  -- reenvía por registrar_venta_sin_conexion y no se duplica (ver 0028).
  insert into public.ventas (id, comercio_id, caja_id, usuario_id, total, descuento)
  values (coalesce(p_venta_id, gen_random_uuid()), v_comercio, p_caja_id, v_uid, v_total, v_desc_total)
  returning id, created_at into v_venta_id, v_created;

  -- Paso 4: ítems con snapshot (precio, promo y descuentos) y movimientos de stock.
  for v_linea in select value from jsonb_array_elements(v_lineas) loop
    insert into public.venta_items
      (comercio_id, venta_id, producto_id, nombre, precio_unitario, cantidad,
       descuento, promocion_nombre, promocion_descuento, subtotal)
    values
      (v_comercio, v_venta_id,
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
      (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id)
    values
      (v_comercio, (v_linea ->> 'producto_id')::uuid, 'venta',
       -((v_linea ->> 'cantidad')::integer), v_venta_id, v_uid);
  end loop;

  -- Pagos: igual que en 0012 y 0013.
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

revoke execute on function public.registrar_venta(uuid, jsonb, jsonb, numeric, uuid) from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb, jsonb, numeric, uuid) to authenticated;
