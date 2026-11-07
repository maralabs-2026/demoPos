-- Bloque 3.3a: servicios sin stock (cargas de celular, fotocopias, SUBE).
--
-- Un producto con controla_stock = false es un servicio:
--   - Nunca frena una venta por stock ni genera movimientos de stock: así el stock sigue siendo la
--     suma de los movimientos, y si un día vuelve a controlar stock, la cuenta es la de antes.
--   - No se le cargan ingresos, ajustes ni auditorías (el trigger lo impide), y su stock mínimo es
--     0, así que no aparece en reposición ni en las alertas de mínimo.
--   - Sus ventas quedan registradas igual (venta_items), con cantidad y precio.
-- registrar_venta y registrar_venta_sin_conexion son las de 0029 y 0028, con esos cambios.
-- guardar_producto (0010) recibe la marca; sin ella, el producto controla stock como siempre.
--
--   PV027 un servicio no lleva stock

alter table public.productos
  add column controla_stock boolean not null default true,
  add constraint productos_servicio_sin_minimo check (controla_stock or stock_minimo = 0);

-- productos se escribe por columna (0006): la marca se suma a las que dueño y encargado escriben,
-- con la misma RLS. stock_actual sigue sin permiso: solo lo toca el trigger.
grant insert (controla_stock), update (controla_stock) on public.productos to authenticated;

create or replace function public.aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock integer;
  v_controla boolean;
begin
  update public.productos
     set stock_actual = stock_actual + new.cantidad
   where id = new.producto_id
     and comercio_id = new.comercio_id
     and controla_stock
  returning stock_actual into v_stock;

  if not found then
    select controla_stock into v_controla
      from public.productos
     where id = new.producto_id and comercio_id = new.comercio_id;
    if v_controla is false then
      raise exception 'Un servicio no lleva stock' using errcode = 'PV027';
    end if;
    return new;
  end if;

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

create or replace function public.registrar_venta(
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
  v_controla boolean[] := '{}';
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

    select id, nombre, precio, stock_actual, categoria_id, controla_stock into v_prod
      from public.productos
     where id = v_item.producto_id and comercio_id = v_comercio
       for update;
    if not found then
      raise exception 'Un producto de la venta no existe' using errcode = 'PV005';
    end if;

    -- Un servicio (0031) no lleva stock: nunca frena la venta.
    if v_prod.controla_stock and v_prod.stock_actual < v_item.cantidad then
      raise exception 'Stock insuficiente de "%": quedan %, se pidieron %',
        v_prod.nombre, v_prod.stock_actual, v_item.cantidad
        using errcode = 'PV001', detail = v_prod.id::text;
    end if;

    v_ids := array_append(v_ids, v_prod.id);
    v_nombres_prod := array_append(v_nombres_prod, v_prod.nombre);
    v_precios := array_append(v_precios, v_prod.precio);
    v_categorias := array_append(v_categorias, v_prod.categoria_id);
    v_controla := array_append(v_controla, v_prod.controla_stock);
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
      'descuento', v_desc_item,
      'controla', v_controla[v_i]
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

    -- Un servicio no genera movimientos de stock.
    if (v_linea ->> 'controla')::boolean then
      insert into public.movimientos_stock
        (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id)
      values
        (v_comercio, (v_linea ->> 'producto_id')::uuid, 'venta',
         -((v_linea ->> 'cantidad')::integer), v_venta_id, v_uid);
    end if;
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

create or replace function public.registrar_venta_sin_conexion(
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

    select id, nombre, precio, stock_actual, controla_stock into v_prod
      from public.productos
     where id = v_item.producto_id and comercio_id = v_comercio
       for update;
    if not found then
      raise exception 'Un producto de la venta no existe' using errcode = 'PV005';
    end if;

    if v_prod.precio <> v_item.precio and not ('precio' = any (v_avisos)) then
      v_avisos := v_avisos || 'precio'::text;
    end if;
    if v_prod.controla_stock and v_prod.stock_actual < v_item.cantidad
       and not ('stock' = any (v_avisos)) then
      v_avisos := v_avisos || 'stock'::text;
    end if;

    v_neto := v_neto + v_bruto - v_item.descuento;
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod.id, 'nombre', v_prod.nombre, 'precio', v_item.precio,
      'cantidad', v_item.cantidad, 'descuento', v_item.descuento,
      'promo_nombre', case when v_item.promo_desc > 0 then v_item.promo_nombre end,
      'promo_descuento', v_item.promo_desc, 'controla', v_prod.controla_stock));
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

    if (v_linea ->> 'controla')::boolean then
      insert into public.movimientos_stock
        (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id, created_at)
      values
        (v_comercio, (v_linea ->> 'producto_id')::uuid, 'venta',
         -((v_linea ->> 'cantidad')::integer), p_venta_id, v_uid, v_fecha);
    end if;
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

drop function public.guardar_producto(uuid, uuid, text, text, numeric, text, integer, numeric, numeric, numeric);

create function public.guardar_producto(
  p_id uuid,
  p_categoria_id uuid,
  p_nombre text,
  p_codigo_barras text,
  p_precio numeric,
  p_unidad_venta text,
  p_stock_minimo integer,
  p_costo numeric,
  p_precio_anterior numeric default null,
  p_costo_anterior numeric default null,
  p_controla_stock boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_comercio_id uuid := public.current_comercio_id();
  v_id uuid;
  v_precio_actual numeric;
  v_costo_actual numeric;
begin
  -- La RLS de UPDATE filtra en silencio; el chequeo explícito da un error claro.
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede gestionar productos' using errcode = '42501';
  end if;

  -- categorias.comercio_id no forma parte de la FK de productos: se valida acá (la RLS de
  -- categorias ya oculta las de otros comercios).
  if p_categoria_id is not null and not exists (
    select 1 from public.categorias where id = p_categoria_id and comercio_id = v_comercio_id
  ) then
    raise exception 'La categoría no existe' using errcode = 'PV008';
  end if;

  if p_id is null then
    insert into public.productos
      (comercio_id, categoria_id, nombre, codigo_barras, precio, unidad_venta, stock_minimo,
       controla_stock)
    values
      (v_comercio_id, p_categoria_id, p_nombre, p_codigo_barras, p_precio, p_unidad_venta,
       case when coalesce(p_controla_stock, true) then p_stock_minimo else 0 end,
       coalesce(p_controla_stock, true))
    returning id into v_id;
  else
    -- FOR UPDATE: nadie más cambia el producto entre esta lectura y el UPDATE.
    select p.precio, c.costo into v_precio_actual, v_costo_actual
      from public.productos p
      left join public.productos_costos c on c.producto_id = p.id
     where p.id = p_id and p.comercio_id = v_comercio_id
       for update of p;
    if not found then
      raise exception 'El producto no existe' using errcode = 'PV005';
    end if;
    if v_precio_actual is distinct from p_precio_anterior
       or v_costo_actual is distinct from p_costo_anterior then
      raise exception 'Otro usuario cambió el precio o el costo mientras editabas'
        using errcode = 'PV009';
    end if;

    update public.productos
       set categoria_id = p_categoria_id,
           nombre = p_nombre,
           codigo_barras = p_codigo_barras,
           precio = p_precio,
           unidad_venta = p_unidad_venta,
           stock_minimo = case when coalesce(p_controla_stock, true) then p_stock_minimo else 0 end,
           controla_stock = coalesce(p_controla_stock, true)
     where id = p_id and comercio_id = v_comercio_id
    returning id into v_id;
  end if;

  if p_costo is null then
    delete from public.productos_costos where producto_id = v_id;
  else
    insert into public.productos_costos (producto_id, comercio_id, costo)
    values (v_id, v_comercio_id, p_costo)
    on conflict (producto_id) do update
      set costo = excluded.costo, updated_at = now();
  end if;

  return v_id;
end;
$$;

revoke execute on function public.guardar_producto(uuid, uuid, text, text, numeric, text, integer, numeric, numeric, numeric, boolean)
  from public, anon;
grant execute on function public.guardar_producto(uuid, uuid, text, text, numeric, text, integer, numeric, numeric, numeric, boolean)
  to authenticated;
