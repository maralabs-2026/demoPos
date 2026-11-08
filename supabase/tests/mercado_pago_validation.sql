-- Validación de la base de Mercado Pago (0037).
-- Necesita las migraciones 0001-0037. Crea sus propios comercios para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/mercado_pago_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000037a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000037a2';
  cajero2 constant uuid := '00000000-0000-4000-8000-0000000037a3';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000037a4';
  comercio uuid;
  otro uuid;
  punto uuid;
  punto_ajeno uuid;
  c1 uuid;
  n int;
  e text;
  ok text[] := '{}';
begin
  insert into public.comercios (nombre) values ('Comercio MP (test)') returning id into comercio;
  insert into public.comercios (nombre) values ('Otro comercio MP (test)') returning id into otro;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, cajero, cajero2, otro_dueno]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'), (cajero, comercio, 'cajero', 'Cajero (test)'),
         (cajero2, comercio, 'cajero', 'Cajero 2 (test)'), (otro_dueno, otro, 'dueno', 'Otro (test)');
  insert into public.mp_puntos (comercio_id, nombre, external_pos_id)
  values (otro, 'Caja ajena', 'AJENA1') returning id into punto_ajeno;

  -- (a) Puntos: el dueño los crea, el cajero no.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  insert into public.mp_puntos (comercio_id, nombre, external_pos_id)
  values (comercio, 'Caja 1', 'CAJA1') returning id into punto;
  perform set_config('request.jwt.claims', json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    insert into public.mp_puntos (comercio_id, nombre, external_pos_id) values (comercio, 'X', 'X1');
    raise exception 'FAIL (a): el cajero creó un punto';
  exception when insufficient_privilege then
    ok := ok || 'a: puntos solo dueño'::text;
  end;

  -- (b) No se puede usar el punto de otro comercio.
  begin
    perform public.crear_mp_cobro(punto_ajeno, 100);
    raise exception 'FAIL (b): usó un punto ajeno';
  exception when sqlstate 'PV029' then
    ok := ok || 'b: punto ajeno rechazado'::text;
  end;

  -- (c) Un solo cobro pendiente por QR.
  c1 := public.crear_mp_cobro(punto, 1500.50);
  perform public.fijar_orden_mp_cobro(c1, 'ORD1');
  perform set_config('request.jwt.claims', json_build_object('sub', cajero2, 'role', 'authenticated')::text, true);
  begin
    perform public.crear_mp_cobro(punto, 200);
    raise exception 'FAIL (c): dos cobros en el mismo QR';
  exception when sqlstate 'PV030' then
    ok := ok || 'c: un pendiente por QR'::text;
  end;

  -- (d) Otro cajero no lo ve ni lo toca, y nadie escribe directo.
  select count(*) into n from public.mp_cobros where id = c1;
  if n <> 0 then raise exception 'FAIL (d): el otro cajero ve el cobro'; end if;
  begin
    perform public.cancelar_mp_cobro(c1);
    raise exception 'FAIL (d): el otro cajero lo canceló';
  exception when sqlstate 'PV031' then null;
  end;
  begin
    update public.mp_cobros set estado = 'aprobado' where id = c1;
    raise exception 'FAIL (d): escribió directo';
  exception when insufficient_privilege then
    ok := ok || 'd: cobro aislado y sin escritura'::text;
  end;

  -- (e) Un usuario no puede aplicar un resultado.
  begin
    perform public.aplicar_estado_mp_cobro(c1, 'ORD1', 'aprobado', 1500.50);
    raise exception 'FAIL (e): un usuario aprobó un cobro';
  exception when insufficient_privilege then
    ok := ok || 'e: aplicar solo service role'::text;
  end;

  -- (f) Service role: orden ajena no cambia; monto distinto es error; luego no retrocede.
  execute 'reset role';
  execute 'set local role service_role';
  e := public.aplicar_estado_mp_cobro(c1, 'ORD-OTRA', 'aprobado', 1500.50);
  if e <> 'pendiente' then raise exception 'FAIL (f): aceptó otra orden: %', e; end if;
  e := public.aplicar_estado_mp_cobro(c1, 'ORD1', 'aprobado', 10);
  if e <> 'error' then raise exception 'FAIL (f): monto distinto dio %', e; end if;
  e := public.aplicar_estado_mp_cobro(c1, 'ORD1', 'cancelado', null);
  if e <> 'error' then raise exception 'FAIL (f): retrocedió a %', e; end if;
  if public.aplicar_estado_mp_cobro(gen_random_uuid(), 'X', 'aprobado', 1) is not null then
    raise exception 'FAIL (f): inventó un cobro';
  end if;
  ok := ok || 'f: orden, monto y transiciones'::text;
  execute 'reset role';

  -- (g) Cancelado y pagado igual: manda el pago. Después puede reintegrarse.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  c1 := public.crear_mp_cobro(punto, 300);
  perform public.cancelar_mp_cobro(c1);
  execute 'reset role';
  execute 'set local role service_role';
  e := public.aplicar_estado_mp_cobro(c1, 'ORD2', 'aprobado', 300);
  if e <> 'aprobado' then raise exception 'FAIL (g): %', e; end if;
  e := public.aplicar_estado_mp_cobro(c1, 'ORD2', 'reintegrado', 300);
  if e <> 'reintegrado' then raise exception 'FAIL (g): reintegro %', e; end if;
  ok := ok || 'g: pago manda y reintegro'::text;
  execute 'reset role';

  -- (h) Sin acceso anónimo y un pendiente vencido libera el QR.
  if has_table_privilege('anon', 'public.mp_cobros', 'SELECT')
     or has_function_privilege('anon', 'public.crear_mp_cobro(uuid, numeric)', 'execute') then
    raise exception 'FAIL (h): anon tiene acceso';
  end if;
  insert into public.mp_cobros (comercio_id, punto_id, creado_por, monto, created_at)
  values (comercio, punto, cajero, 50, now() - interval '30 minutes');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  c1 := public.crear_mp_cobro(punto, 60);
  if c1 is null then raise exception 'FAIL (h): no liberó el QR'; end if;
  ok := ok || 'h: sin anon y vencido libera'::text;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
