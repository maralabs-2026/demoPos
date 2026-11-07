-- Validación de los servicios sin stock (0031).
-- Necesita las migraciones 0001-0031. Crea su propio comercio para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/servicios_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000031a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000031a2';
  offline constant uuid := '00000000-0000-4000-8000-0000000031b1';
  comercio uuid;
  carga uuid;
  agua uuid;
  efectivo uuid;
  caja uuid;
  venta uuid;
  r jsonb;
  ok text[] := '{}';
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'controla_stock') then
    raise exception 'FAIL: falta productos.controla_stock (aplicar la migración 0031)';
  end if;

  insert into public.comercios (nombre) values ('Comercio servicios (test)') returning id into comercio;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, cajero]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'), (cajero, comercio, 'cajero', 'Cajero (test)');
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo')
  returning id into efectivo;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial, abierta_at)
  values (comercio, cajero, 0, now() - interval '1 hour') returning id into caja;

  -- (a) El dueño crea un servicio con guardar_producto: el stock mínimo queda en 0.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  carga := public.guardar_producto(null, null, 'Carga celular (test)', '3100000000001', 1000,
    'unidad', 5, null, null, null, false);
  agua := public.guardar_producto(null, null, 'Agua (test)', '3100000000002', 800,
    'unidad', 2, null);
  execute 'reset role';
  if (select controla_stock from public.productos where id = carga)
     or (select stock_minimo from public.productos where id = carga) <> 0
     or not (select controla_stock from public.productos where id = agua) then
    raise exception 'FAIL (a): la marca o el mínimo no quedaron bien';
  end if;
  ok := ok || 'a: el servicio se crea sin stock mínimo'::text;

  -- (b) Un servicio no admite ingresos ni ajustes.
  begin
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
    values (comercio, carga, 'ingreso', 10, null, dueno);
    raise exception 'FAIL (b): se cargó stock a un servicio';
  exception when sqlstate 'PV027' then
    ok := ok || 'b: un servicio no lleva stock'::text;
  end;
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ingreso', 1, null, dueno);

  -- (c) Se vende sin stock, varias unidades, sin movimientos; el producto con stock sigue igual.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  r := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 3),
                      jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 3800)));
  venta := (r ->> 'venta_id')::uuid;
  execute 'reset role';
  if exists (select 1 from public.movimientos_stock where producto_id = carga)
     or (select stock_actual from public.productos where id = carga) <> 0
     or (select stock_actual from public.productos where id = agua) <> 0
     or (select cantidad from public.venta_items where venta_id = venta and producto_id = carga) <> 3 then
    raise exception 'FAIL (c): stock o ítems mal';
  end if;
  ok := ok || 'c: se vende sin stock y sin movimientos'::text;

  -- (d) Un producto común sigue exigiendo stock.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 800)));
    raise exception 'FAIL (d): vendió agua sin stock';
  exception when sqlstate 'PV001' then
    ok := ok || 'd: los productos comunes siguen exigiendo stock'::text;
  end;

  -- (e) Sin conexión, el servicio no genera aviso de stock ni movimientos.
  r := public.registrar_venta_sin_conexion(offline, caja, now(),
    jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 2, 'precio_unitario', 1000)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2000)));
  if jsonb_array_length(r -> 'avisos') <> 0 then
    raise exception 'FAIL (e): avisos = %', r -> 'avisos';
  end if;
  execute 'reset role';
  if exists (select 1 from public.movimientos_stock where producto_id = carga) then
    raise exception 'FAIL (e): la venta sin conexión movió el stock del servicio';
  end if;
  ok := ok || 'e: sin conexión tampoco mueve stock'::text;

  -- (f) Anular la venta devuelve el stock del agua y no toca el servicio.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.anular_venta(venta, 'Validación servicios');
  execute 'reset role';
  if (select stock_actual from public.productos where id = agua) <> 1
     or exists (select 1 from public.movimientos_stock where producto_id = carga) then
    raise exception 'FAIL (f): la anulación movió mal el stock';
  end if;
  ok := ok || 'f: anular devuelve solo el stock de los productos'::text;

  -- (g) Un servicio no puede tener stock mínimo, ni a mano.
  begin
    update public.productos set stock_minimo = 3 where id = carga;
    raise exception 'FAIL (g): un servicio quedó con mínimo';
  exception when check_violation then
    ok := ok || 'g: sin stock mínimo'::text;
  end;

  -- (h) Si vuelve a controlar stock, la cuenta es la suma de sus movimientos (ninguno: 0).
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.guardar_producto(carga, null, 'Carga celular (test)', '3100000000001', 1000,
    'unidad', 0, null, 1000, null, true);
  execute 'reset role';
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, carga, 'ingreso', 4, null, dueno);
  if (select stock_actual from public.productos where id = carga) <> 4 then
    raise exception 'FAIL (h): stock al volver a controlar = %',
      (select stock_actual from public.productos where id = carga);
  end if;
  ok := ok || 'h: al volver a controlar, el stock es la suma de movimientos'::text;

  -- (i) Importar un CSV con stock mínimo no se lo pone a un servicio que ya existe.
  execute 'reset role';
  update public.productos set controla_stock = false, stock_minimo = 0 where id = carga;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.importar_productos(jsonb_build_array(jsonb_build_object(
    'nombre', 'Carga celular (test)', 'codigo_barras', '3100000000001', 'precio', 1200,
    'unidad_venta', 'unidad', 'stock_minimo', 5)));
  execute 'reset role';
  if (select stock_minimo from public.productos where id = carga) <> 0
     or (select precio from public.productos where id = carga) <> 1200 then
    raise exception 'FAIL (i): la importación le puso mínimo al servicio';
  end if;
  ok := ok || 'i: la importación respeta los servicios'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
