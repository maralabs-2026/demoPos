-- Validación del precio al cobrar (0032).
-- Necesita las migraciones 0001-0032. Crea su propio comercio para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/precio_al_cobrar_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000032a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000032a2';
  offline constant uuid := '00000000-0000-4000-8000-0000000032b1';
  comercio uuid;
  carga uuid;
  agua uuid;
  efectivo uuid;
  caja uuid;
  r jsonb;
  ok text[] := '{}';
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'precio_libre') then
    raise exception 'FAIL: falta productos.precio_libre (aplicar la migración 0032)';
  end if;

  insert into public.comercios (nombre) values ('Comercio precio libre (test)') returning id into comercio;
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

  -- (a) Un servicio con precio al cobrar y precio sugerido 0; un producto común.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  carga := public.guardar_producto(null, null, 'Carga (test)', '3200000000001', 0,
    'unidad', 0, null, null, null, false, true);
  agua := public.guardar_producto(null, null, 'Agua (test)', '3200000000002', 800,
    'unidad', 0, null);
  execute 'reset role';
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ingreso', 5, null, dueno);
  if not (select precio_libre from public.productos where id = carga)
     or (select precio_libre from public.productos where id = agua) then
    raise exception 'FAIL (a): la marca no quedó bien';
  end if;
  ok := ok || 'a: se guarda la marca'::text;

  -- (b) Se cobra con el precio de la pantalla y queda guardado en la venta. En el agua, el precio
  -- que mande la pantalla se ignora.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  r := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 2, 'precio', 1500),
                      jsonb_build_object('producto_id', agua, 'cantidad', 1, 'precio', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 3800)));
  if (r ->> 'total')::numeric <> 3800 then
    raise exception 'FAIL (b): total = %', r ->> 'total';
  end if;
  execute 'reset role';
  if (select precio_unitario from public.venta_items
       where venta_id = (r ->> 'venta_id')::uuid and producto_id = carga) <> 1500
     or (select precio_unitario from public.venta_items
       where venta_id = (r ->> 'venta_id')::uuid and producto_id = agua) <> 800 then
    raise exception 'FAIL (b): precios guardados mal';
  end if;
  ok := ok || 'b: usa el precio escrito solo en el producto marcado'::text;

  -- (c) Sin precio, en 0, con más de dos decimales o con dos precios distintos, no se cobra.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)));
    raise exception 'FAIL (c): cobró sin precio';
  exception when sqlstate 'PV004' then null;
  end;
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 1, 'precio', 0)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1)));
    raise exception 'FAIL (c): cobró en 0';
  exception when sqlstate 'PV004' then null;
  end;
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 1, 'precio', 10.005)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 10.01)));
    raise exception 'FAIL (c): aceptó tres decimales';
  exception when sqlstate 'PV004' then null;
  end;
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 1, 'precio', 1000),
                        jsonb_build_object('producto_id', carga, 'cantidad', 1, 'precio', 2000)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 3000)));
    raise exception 'FAIL (c): aceptó dos precios para el mismo producto';
  exception when sqlstate 'PV004' then
    ok := ok || 'c: precio obligatorio, positivo y único'::text;
  end;

  -- (d) El descuento del cajero se calcula sobre el precio escrito: 10 % de $ 1.500.
  r := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 1, 'precio', 1500,
                                         'descuento_pct', 10)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1350)));
  if (r ->> 'total')::numeric <> 1350 then
    raise exception 'FAIL (d): total = %', r ->> 'total';
  end if;
  ok := ok || 'd: los descuentos van sobre el precio escrito'::text;

  -- (e) Sin conexión, un precio distinto del sugerido no genera aviso.
  r := public.registrar_venta_sin_conexion(offline, caja, now(),
    jsonb_build_array(jsonb_build_object('producto_id', carga, 'cantidad', 1, 'precio_unitario', 2000)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2000)));
  if jsonb_array_length(r -> 'avisos') <> 0 then
    raise exception 'FAIL (e): avisos = %', r -> 'avisos';
  end if;
  ok := ok || 'e: sin conexión no avisa precio'::text;

  -- (f) Editar mandando la marca la conserva (la pantalla siempre la manda).
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.guardar_producto(carga, null, 'Carga (test)', '3200000000001', 0,
    'unidad', 0, null, 0, null, false, true);
  execute 'reset role';
  if not (select precio_libre from public.productos where id = carga) then
    raise exception 'FAIL (f): editar con la marca la sacó';
  end if;
  ok := ok || 'f: editar conserva la marca'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
