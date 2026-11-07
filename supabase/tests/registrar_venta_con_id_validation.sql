-- Validación de registrar_venta con el id del dispositivo (0029).
-- Necesita las migraciones 0001-0029. Crea su propio comercio para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/registrar_venta_con_id_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  cajero constant uuid := '00000000-0000-4000-8000-0000000029a1';
  venta_id constant uuid := '00000000-0000-4000-8000-0000000029b1';
  comercio uuid;
  agua uuid;
  efectivo uuid;
  caja uuid;
  r jsonb;
  ok text[] := '{}';
begin
  if to_regprocedure('public.registrar_venta(uuid, jsonb, jsonb, numeric, uuid)') is null then
    raise exception 'FAIL: falta registrar_venta con p_venta_id (aplicar la migración 0029)';
  end if;
  if to_regprocedure('public.registrar_venta(uuid, jsonb, jsonb, numeric)') is not null then
    raise exception 'FAIL: quedó la versión anterior de registrar_venta';
  end if;

  insert into public.comercios (nombre) values ('Comercio venta con id (test)') returning id into comercio;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
          'cajero.conid@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre) values (cajero, comercio, 'cajero', 'Cajero (test)');
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Agua (test)', '2900000000001', 1000) returning id into agua;
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ajuste', 5, 'Validación', cajero);
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo')
  returning id into efectivo;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial, abierta_at)
  values (comercio, cajero, 0, now() - interval '1 hour') returning id into caja;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);

  -- (a) Sin id, como hasta ahora: la base lo genera.
  r := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)));
  if r ->> 'venta_id' is null or (r ->> 'venta_id')::uuid = venta_id then
    raise exception 'FAIL (a): resultado = %', r;
  end if;
  ok := ok || 'a: sin id funciona igual que antes'::text;

  -- (b) Con id, la venta usa ese id.
  r := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)),
    0, venta_id);
  if (r ->> 'venta_id')::uuid <> venta_id then
    raise exception 'FAIL (b): resultado = %', r;
  end if;
  ok := ok || 'b: usa el id del dispositivo'::text;

  -- (c) Si la respuesta se perdió y la pantalla la reenvía sin conexión, devuelve la misma venta.
  r := public.registrar_venta_sin_conexion(venta_id, caja, now(),
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1, 'precio_unitario', 1000)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)));
  if not (r ->> 'repetida')::boolean then
    raise exception 'FAIL (c): resultado = %', r;
  end if;
  execute 'reset role';
  if (select count(*) from public.ventas where comercio_id = comercio) <> 2
     or (select stock_actual from public.productos where id = agua) <> 3 then
    raise exception 'FAIL (c): se duplicó la venta o el stock';
  end if;
  if (select sin_conexion from public.ventas where id = venta_id) then
    raise exception 'FAIL (c): la venta online quedó marcada como sin conexión';
  end if;
  ok := ok || 'c: el reenvío sin conexión no duplica la venta online'::text;

  -- (d) El mismo id dos veces por la vía online falla sin dejar rastro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)),
      0, venta_id);
    raise exception 'FAIL (d): registró dos veces el mismo id';
  exception when unique_violation then
    null;
  end;
  execute 'reset role';
  if (select stock_actual from public.productos where id = agua) <> 3 then
    raise exception 'FAIL (d): el intento fallido tocó el stock';
  end if;
  ok := ok || 'd: un id repetido no deja rastro'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
