-- Validación de la revisión de ventas sin conexión (0030).
-- Necesita las migraciones 0001-0030. Crea sus propios comercios para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/venta_revisada_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000030a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000030a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000030a3';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000030a4';
  offline constant uuid := '00000000-0000-4000-8000-0000000030b1';
  comercio uuid;
  otro uuid;
  agua uuid;
  efectivo uuid;
  caja uuid;
  online uuid;
  r jsonb;
  primera timestamptz;
  ok text[] := '{}';
begin
  if to_regprocedure('public.marcar_venta_revisada(uuid)') is null then
    raise exception 'FAIL: falta marcar_venta_revisada (aplicar la migración 0030)';
  end if;

  insert into public.comercios (nombre) values ('Comercio revisión (test)') returning id into comercio;
  insert into public.comercios (nombre) values ('Otro comercio revisión (test)') returning id into otro;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, encargado, cajero, otro_dueno]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'),
         (encargado, comercio, 'encargado', 'Encargado (test)'),
         (cajero, comercio, 'cajero', 'Cajero (test)'),
         (otro_dueno, otro, 'dueno', 'Otro dueño (test)');
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Agua (test)', '3000000000001', 1000) returning id into agua;
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ajuste', 5, 'Validación', dueno);
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo')
  returning id into efectivo;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial, abierta_at)
  values (comercio, cajero, 0, now() - interval '1 hour') returning id into caja;

  -- Una venta sin conexión con aviso de precio y una online.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.registrar_venta_sin_conexion(offline, caja, now(),
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1, 'precio_unitario', 900)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 900)));
  online := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000))) ->> 'venta_id')::uuid;

  -- (a) El cajero no revisa.
  begin
    perform public.marcar_venta_revisada(offline);
    raise exception 'FAIL (a): el cajero revisó';
  exception when insufficient_privilege then
    ok := ok || 'a: el cajero no revisa'::text;
  end;

  -- (b) Otro comercio no la encuentra.
  perform set_config('request.jwt.claims',
    json_build_object('sub', otro_dueno, 'role', 'authenticated')::text, true);
  begin
    perform public.marcar_venta_revisada(offline);
    raise exception 'FAIL (b): otro comercio revisó';
  exception when sqlstate 'PV026' then
    ok := ok || 'b: otro comercio no la ve'::text;
  end;

  -- (c) Una venta online no se revisa.
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  begin
    perform public.marcar_venta_revisada(online);
    raise exception 'FAIL (c): revisó una venta online';
  exception when sqlstate 'PV026' then
    ok := ok || 'c: solo ventas sin conexión'::text;
  end;

  -- (d) El encargado la revisa: queda quién y cuándo, sin tocar la venta ni el stock.
  r := public.marcar_venta_revisada(offline);
  if (r ->> 'revisada_por')::uuid <> encargado or r ->> 'revisada_at' is null then
    raise exception 'FAIL (d): resultado = %', r;
  end if;
  primera := (r ->> 'revisada_at')::timestamptz;
  execute 'reset role';
  if (select total from public.ventas where id = offline) <> 900
     or (select stock_actual from public.productos where id = agua) <> 3 then
    raise exception 'FAIL (d): revisar cambió la venta o el stock';
  end if;
  ok := ok || 'd: el encargado la revisa sin tocar la venta'::text;

  -- (e) Marcarla de nuevo no cambia quién la revisó.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  r := public.marcar_venta_revisada(offline);
  if (r ->> 'revisada_por')::uuid <> encargado or (r ->> 'revisada_at')::timestamptz <> primera then
    raise exception 'FAIL (e): resultado = %', r;
  end if;
  ok := ok || 'e: revisar dos veces no cambia nada'::text;

  -- (f) Nadie escribe la marca a mano.
  begin
    update public.ventas set revisada_at = null, revisada_por = null where id = offline;
    if found then
      raise exception 'FAIL (f): se pudo borrar la revisión a mano';
    end if;
    ok := ok || 'f: sin escritura directa'::text;
  exception when insufficient_privilege then
    ok := ok || 'f: sin escritura directa'::text;
  end;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
