-- Validación de los vencimientos por ingreso (0033).
-- Necesita las migraciones 0001-0033. Crea sus propios comercios para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/vencimientos_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000033a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000033a2';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000033a3';
  hoy constant date := (now() at time zone 'America/Argentina/Cordoba')::date;
  comercio uuid;
  otro uuid;
  leche uuid;
  agua uuid;
  efectivo uuid;
  caja uuid;
  r jsonb;
  ok text[] := '{}';
begin
  if to_regprocedure('public.vencimientos_proximos()') is null then
    raise exception 'FAIL: falta vencimientos_proximos (aplicar la migración 0033)';
  end if;

  insert into public.comercios (nombre) values ('Comercio vencimientos (test)') returning id into comercio;
  insert into public.comercios (nombre) values ('Otro comercio vencimientos (test)') returning id into otro;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, cajero, otro_dueno]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'), (cajero, comercio, 'cajero', 'Cajero (test)'),
         (otro_dueno, otro, 'dueno', 'Otro dueño (test)');
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Leche (test)', '3300000000001', 1000) returning id into leche;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Agua (test)', '3300000000002', 500) returning id into agua;
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo')
  returning id into efectivo;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 0) returning id into caja;

  -- Leche: 4 vencen en 10 días y 6 en 60. Agua: 3 ya vencidas y 2 sin fecha.
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, usuario_id, vencimiento)
  values (comercio, leche, 'ingreso', 4, dueno, hoy + 10),
         (comercio, leche, 'ingreso', 6, dueno, hoy + 60),
         (comercio, agua, 'ingreso', 3, dueno, hoy - 1),
         (comercio, agua, 'ingreso', 2, dueno, null);

  -- (a) Un vencimiento solo va en un ingreso.
  begin
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id, vencimiento)
    values (comercio, leche, 'ajuste', 1, 'Validación', dueno, hoy);
    raise exception 'FAIL (a): un ajuste llevó vencimiento';
  exception when check_violation then
    ok := ok || 'a: solo los ingresos llevan fecha'::text;
  end;

  -- (b) Avisa lo vencido y lo que vence dentro de 30 días, no lo que vence después.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  r := public.vencimientos_proximos();
  if jsonb_array_length(r) <> 2
     or r -> 0 ->> 'nombre' <> 'Agua (test)' or (r -> 0 ->> 'vencido')::boolean is not true
     or (r -> 0 ->> 'cantidad')::int <> 3
     or r -> 1 ->> 'nombre' <> 'Leche (test)' or (r -> 1 ->> 'vencido')::boolean
     or (r -> 1 ->> 'cantidad')::int <> 4 then
    raise exception 'FAIL (b): %', r;
  end if;
  ok := ok || 'b: avisa lo vencido y lo próximo, con la fecha más cercana primero'::text;

  -- (c) Se vende primero lo que vence antes: quedan 7 de leche, 6 son del lote lejano y 1 del cercano.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', leche, 'cantidad', 3)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 3000)));
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  r := public.vencimientos_proximos();
  if (r -> 1 ->> 'cantidad')::int <> 1 then
    raise exception 'FAIL (c): %', r;
  end if;
  ok := ok || 'c: las ventas consumen primero lo que vence antes'::text;

  -- (d) Cuando se vendió todo lo de ese vencimiento, el aviso desaparece.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', leche, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)));
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  r := public.vencimientos_proximos();
  if jsonb_array_length(r) <> 1 or r -> 0 ->> 'nombre' <> 'Agua (test)' then
    raise exception 'FAIL (d): %', r;
  end if;
  ok := ok || 'd: sin unidades de ese vencimiento, no avisa'::text;

  -- (e) Los días de aviso salen de la configuración; un valor inválido vuelve a 30.
  execute 'reset role';
  insert into public.configuracion (comercio_id, clave, valor)
  values (comercio, 'vencimiento_aviso_dias', '90');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  r := public.vencimientos_proximos();
  if jsonb_array_length(r) <> 2 or (r -> 1 ->> 'cantidad')::int <> 6 then
    raise exception 'FAIL (e): con 90 días = %', r;
  end if;
  execute 'reset role';
  update public.configuracion set valor = '999'
   where comercio_id = comercio and clave = 'vencimiento_aviso_dias';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  if jsonb_array_length(public.vencimientos_proximos()) <> 1 then
    raise exception 'FAIL (e): un valor inválido no volvió a 30';
  end if;
  ok := ok || 'e: días de aviso configurables'::text;

  -- (f) El cajero no los ve y otro comercio no ve los de este.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.vencimientos_proximos();
    raise exception 'FAIL (f): el cajero vio los vencimientos';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', otro_dueno, 'role', 'authenticated')::text, true);
  if jsonb_array_length(public.vencimientos_proximos()) <> 0 then
    raise exception 'FAIL (f): otro comercio vio vencimientos ajenos';
  end if;
  ok := ok || 'f: por rol y por comercio'::text;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
