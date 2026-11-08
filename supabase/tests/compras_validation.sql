-- Validación de las compras a proveedores (0035).
-- Necesita las migraciones 0001-0035. Crea sus propios comercios para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/compras_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000035a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000035a2';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000035a3';
  hoy constant date := (now() at time zone 'America/Argentina/Cordoba')::date;
  comercio uuid;
  otro uuid;
  prov uuid;
  inactivo uuid;
  agua uuid;
  taza uuid;
  carga uuid;
  caja uuid;
  medio uuid;
  r jsonb;
  items jsonb;
  antes numeric;
  rep jsonb;
  n integer;
  ok text[] := '{}';
begin
  if to_regprocedure('public.registrar_compra(uuid, text, jsonb, text, uuid, date)') is null then
    raise exception 'FAIL: falta registrar_compra (aplicar la migración 0035)';
  end if;

  insert into public.comercios (nombre) values ('Comercio compras (test)') returning id into comercio;
  insert into public.comercios (nombre) values ('Otro comercio compras (test)') returning id into otro;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, cajero, otro_dueno]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'), (cajero, comercio, 'cajero', 'Cajero (test)'),
         (otro_dueno, otro, 'dueno', 'Otro dueño (test)');
  insert into public.proveedores (comercio_id, nombre) values (comercio, 'Distribuidora (test)') returning id into prov;
  insert into public.proveedores (comercio_id, nombre, activo) values (comercio, 'Inactivo (test)', false) returning id into inactivo;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Agua (test)', '3500000000001', 1000) returning id into agua;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Taza (test)', '3500000000002', 2000) returning id into taza;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio, controla_stock)
  values (comercio, 'Carga (test)', '3500000000003', 0, false) returning id into carga;
  insert into public.productos_costos (producto_id, comercio_id, costo) values (agua, comercio, 500);
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo') returning id into medio;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial) values (comercio, dueno, 10000) returning id into caja;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);

  -- (a) Compra pagada con la caja: stock con vencimiento, costo nuevo con bonificación, ítems y retiro.
  -- Agua: lista 800 − 10 % = 720 × 10 = 7.200. Taza (sin costo previo): 600 × 2 = 1.200. Total 8.400.
  items := jsonb_build_array(
    jsonb_build_object('producto_id', agua, 'cantidad', 10, 'costo_lista', 800, 'bonificacion_pct', 10,
                       'vencimiento', hoy + 20),
    jsonb_build_object('producto_id', taza, 'cantidad', 2, 'costo_lista', 600));
  r := public.registrar_compra(prov, ' R-0001 ', items, 'caja', caja);
  execute 'reset role';
  if (r ->> 'total')::numeric <> 8400
     or (select stock_actual from public.productos where id = agua) <> 10
     or (select costo from public.productos_costos where producto_id = agua) <> 720
     or (select costo from public.productos_costos where producto_id = taza) <> 600
     or (select vencimiento from public.movimientos_stock where producto_id = agua) <> hoy + 20
     or (select count(*) from public.compra_items where compra_id = (r ->> 'compra_id')::uuid) <> 2
     or (select comprobante from public.compras where id = (r ->> 'compra_id')::uuid) <> 'R-0001'
     or (select estado || tipo from public.gastos g join public.compras c on c.gasto_id = g.id
          where c.id = (r ->> 'compra_id')::uuid) <> 'pagadomercaderia'
     or (select count(*) from public.caja_movimientos
          where caja_id = caja and tipo = 'retiro' and monto = 8400) <> 1 then
    raise exception 'FAIL (a): %', r;
  end if;
  ok := ok || 'a: stock, costo, ítems, gasto y retiro en una transacción'::text;

  -- (b) Avisa solo los productos cuyo costo subió, con costo previo y precio.
  if jsonb_array_length(r -> 'suben') <> 1 or r -> 'suben' -> 0 ->> 'nombre' <> 'Agua (test)'
     or (r -> 'suben' -> 0 ->> 'costo_anterior')::numeric <> 500
     or (r -> 'suben' -> 0 ->> 'costo_nuevo')::numeric <> 720 then
    raise exception 'FAIL (b): %', r -> 'suben';
  end if;
  ok := ok || 'b: avisa los costos que subieron'::text;

  -- (c) El gasto de mercadería no resta en la ganancia neta; un gasto común sí.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  rep := public.reporte_ventas(hoy, hoy, 'dia');
  if (rep -> 'resumen' ->> 'gastos_pagados')::numeric <> 0 then
    raise exception 'FAIL (c): gastos_pagados = %', rep -> 'resumen' ->> 'gastos_pagados';
  end if;
  perform public.registrar_gasto('Luz (test)', 'fijo', 300, null, true, null);
  rep := public.reporte_ventas(hoy, hoy, 'dia');
  if (rep -> 'resumen' ->> 'gastos_pagados')::numeric <> 300 then
    raise exception 'FAIL (c): con gasto común = %', rep -> 'resumen' ->> 'gastos_pagados';
  end if;
  ok := ok || 'c: la mercadería no resta dos veces en la ganancia neta'::text;

  -- (d) Por fuera no toca la caja; por pagar queda pendiente con vencimiento.
  select count(*) into n from public.caja_movimientos where caja_id = caja;
  r := public.registrar_compra(prov, null,
    jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 1, 'costo_lista', 500)), 'fuera');
  perform public.registrar_compra(prov, 'F-2',
    jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 1, 'costo_lista', 500)),
    'por_pagar', null, hoy + 30);
  execute 'reset role';
  if (select count(*) from public.caja_movimientos where caja_id = caja) <> n
     or not exists (select 1 from public.gastos where comercio_id = comercio and tipo = 'mercaderia'
                     and estado = 'por_pagar' and vencimiento = hoy + 30) then
    raise exception 'FAIL (d): por fuera o por pagar mal';
  end if;
  ok := ok || 'd: por fuera y por pagar'::text;

  -- (e) Datos inválidos no dejan rastro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  select stock_actual into antes from public.productos where id = agua;
  begin
    perform public.registrar_compra(inactivo, null,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1, 'costo_lista', 1)), 'fuera');
    raise exception 'FAIL (e): compró a un proveedor inactivo';
  exception when sqlstate 'PV028' then null;
  end;
  begin
    perform public.registrar_compra(prov, null,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1, 'costo_lista', 1),
                        jsonb_build_object('producto_id', agua, 'cantidad', 1, 'costo_lista', 2)), 'fuera');
    raise exception 'FAIL (e): aceptó un producto repetido';
  exception when sqlstate 'PV028' then null;
  end;
  begin
    perform public.registrar_compra(prov, null,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1, 'costo_lista', 0)), 'fuera');
    raise exception 'FAIL (e): aceptó una compra en cero';
  exception when sqlstate 'PV028' then null;
  end;
  begin
    perform public.registrar_compra(prov, null,
      jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 1, 'costo_lista', 10)), 'fuera');
    raise exception 'FAIL (e): compró un servicio';
  exception when sqlstate 'PV027' then null;
  end;
  if (select stock_actual from public.productos where id = agua) <> antes then
    raise exception 'FAIL (e): quedó rastro en el stock';
  end if;
  ok := ok || 'e: los datos inválidos no dejan rastro'::text;

  -- (f) El cajero no compra ni lee; otro comercio no ve ni usa los datos.
  perform set_config('request.jwt.claims', json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_compra(prov, null,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1, 'costo_lista', 1)), 'fuera');
    raise exception 'FAIL (f): el cajero compró';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.compras;
  if n <> 0 or (select count(*) from public.compra_items) <> 0 then
    raise exception 'FAIL (f): el cajero leyó compras';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', otro_dueno, 'role', 'authenticated')::text, true);
  select count(*) into n from public.compras;
  if n <> 0 then
    raise exception 'FAIL (f): otro comercio leyó compras';
  end if;
  begin
    perform public.registrar_compra(prov, null,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1, 'costo_lista', 1)), 'fuera');
    raise exception 'FAIL (f): otro comercio usó el proveedor';
  exception when sqlstate 'PV028' then
    ok := ok || 'f: por rol y por comercio'::text;
  end;

  -- (g) La compra no se escribe a mano, y registrar_gasto no acepta el tipo mercadería.
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    update public.compras set total = 1;
    raise exception 'FAIL (g): se editó una compra';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.registrar_gasto('Trampa', 'mercaderia', 10, null, true, null);
    raise exception 'FAIL (g): registrar_gasto aceptó mercadería';
  exception when sqlstate 'PV016' then
    ok := ok || 'g: sin escritura directa y tipo reservado'::text;
  end;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
