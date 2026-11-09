-- Validación del código de ajuste (0040).
-- Necesita las migraciones hasta 0040 y el seed base (comercio "Kiosko Demo").
--
--   supabase db query --linked -f supabase/tests/codigo_ajuste_caja_validation.sql
--
-- Un único bloque DO: crea sus datos y SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)"
-- para no dejar rastro. Los roles se simulan como PostgREST. Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000040a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000040a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000040a3';
  otro_cajero constant uuid := '00000000-0000-4000-8000-0000000040a4';
  comercio uuid;
  caja uuid;
  caja_ajena uuid;
  codigo text;
  codigo_viejo text;
  incorrecto text;
  resultado uuid;
  fila record;
  filas integer;
  i integer;
  ok text[] := '{}';
begin
  if to_regprocedure('public.generar_codigo_ajuste(uuid, numeric)') is null then
    raise exception 'FAIL: falta generar_codigo_ajuste (aplicar la migración 0040)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.codigo@test.invalid'),
                 (encargado, 'encargado.codigo@test.invalid'),
                 (cajero, 'cajero.codigo@test.invalid'),
                 (otro_cajero, 'otro.codigo@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (otro_cajero, comercio, 'cajero', 'Otro cajero (test)');

  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 1000) returning id into caja;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, otro_cajero, 0) returning id into caja_ajena;

  -- (a) Solo el dueño genera códigos.
  execute 'set local role authenticated';
  foreach resultado in array array[encargado, cajero] loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', resultado, 'role', 'authenticated')::text, true);
    begin
      perform public.generar_codigo_ajuste(caja, 100);
      raise exception 'FAIL (a): % generó un código', resultado;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  execute 'reset role';
  ok := ok || 'a: solo el dueño genera códigos'::text;

  -- (b) Sin código vigente, el cajero no ajusta.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 10, 'Motivo', '123456');
    raise exception 'FAIL (b): ajustó sin código vigente';
  exception when sqlstate 'PV019' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'b: sin código vigente no hay ajuste'::text;

  -- (c) El dueño genera: 6 dígitos, vence en 10 minutos, guardado cifrado y fuera del alcance de la app.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  select g.codigo into codigo from public.generar_codigo_ajuste(caja, 500) g;
  begin
    perform 1 from public.caja_codigos_ajuste;
    raise exception 'FAIL (c): la app puede leer los códigos';
  exception when insufficient_privilege then
    null;
  end;
  execute 'reset role';
  if codigo !~ '^\d{6}$' then
    raise exception 'FAIL (c): el código % no tiene 6 dígitos', codigo;
  end if;
  select * into fila from public.caja_codigos_ajuste where caja_id = caja;
  if fila.codigo_hash = codigo or fila.monto_max <> 500 or fila.creado_por <> dueno
     or fila.vence_at not between now() + interval '9 minutes' and now() + interval '11 minutes' then
    raise exception 'FAIL (c): el código no quedó como se esperaba';
  end if;
  ok := ok || 'c: el código tiene 6 dígitos, vence en 10 minutos y se guarda cifrado'::text;

  -- (d) Un código incorrecto devuelve null, suma un intento y no registra nada.
  incorrecto := lpad(((codigo::integer + 1) % 1000000)::text, 6, '0');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  resultado := public.registrar_ajuste_caja(caja, 'ingreso', 10, 'Motivo', incorrecto);
  execute 'reset role';
  if resultado is not null then
    raise exception 'FAIL (d): aceptó un código incorrecto';
  end if;
  if (select intentos from public.caja_codigos_ajuste where caja_id = caja) <> 1
     or exists (select 1 from public.caja_movimientos where caja_id = caja) then
    raise exception 'FAIL (d): el intento fallido no quedó registrado o se cargó el ajuste';
  end if;
  ok := ok || 'd: un código incorrecto no ajusta y cuenta el intento'::text;

  -- (e) Un monto mayor al autorizado se rechaza sin gastar el código.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'retiro', 500.01, 'Motivo', codigo);
    raise exception 'FAIL (e): aceptó un monto mayor al autorizado';
  exception when sqlstate 'PV020' then
    null;
  end;
  execute 'reset role';
  if (select usado_at from public.caja_codigos_ajuste where caja_id = caja) is not null then
    raise exception 'FAIL (e): el código se gastó';
  end if;
  ok := ok || 'e: un monto mayor al autorizado se rechaza y el código sigue vigente'::text;

  -- (f) El cajero no usa el código en una caja ajena.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja_ajena, 'ingreso', 10, 'Motivo', codigo);
    raise exception 'FAIL (f): el cajero ajustó una caja ajena';
  exception when sqlstate 'PV002' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'f: el cajero no usa un código en la caja de otro'::text;

  -- (g) Con el código correcto: queda el ajuste, quién lo cargó y quién lo autorizó.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  resultado := public.registrar_ajuste_caja(caja, 'retiro', 500, 'Faltante de cambio', codigo);
  execute 'reset role';
  if not exists (
    select 1 from public.caja_movimientos
     where id = resultado and es_ajuste and usuario_id = cajero and autorizado_por = dueno
       and tipo = 'retiro' and monto = 500
  ) then
    raise exception 'FAIL (g): el ajuste no quedó como se registró';
  end if;
  select * into fila from public.caja_codigos_ajuste where caja_id = caja;
  if fila.usado_at is null or fila.usado_por <> cajero then
    raise exception 'FAIL (g): el código no quedó usado';
  end if;
  ok := ok || 'g: el ajuste queda con quién lo cargó y quién lo autorizó'::text;

  -- (h) Un código sirve una sola vez.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'retiro', 1, 'Motivo', codigo);
    raise exception 'FAIL (h): el código se usó dos veces';
  exception when sqlstate 'PV019' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'h: un código sirve una sola vez'::text;

  -- (i) Un código nuevo anula al anterior.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  select g.codigo into codigo_viejo from public.generar_codigo_ajuste(caja, 100) g;
  select g.codigo into codigo from public.generar_codigo_ajuste(caja, 100) g;
  execute 'reset role';
  select count(*) into filas from public.caja_codigos_ajuste
   where caja_id = caja and usado_at is null and anulado_at is null;
  if filas <> 1 then
    raise exception 'FAIL (i): hay % códigos vigentes', filas;
  end if;
  if codigo_viejo <> codigo then
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    if public.registrar_ajuste_caja(caja, 'ingreso', 1, 'Motivo', codigo_viejo) is not null then
      raise exception 'FAIL (i): el código anterior siguió sirviendo';
    end if;
    execute 'reset role';
  end if;
  ok := ok || 'i: un código nuevo anula al anterior'::text;

  -- (j) Un código vencido no sirve.
  update public.caja_codigos_ajuste set vence_at = now() - interval '1 second'
   where caja_id = caja and usado_at is null and anulado_at is null;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 1, 'Motivo', codigo);
    raise exception 'FAIL (j): aceptó un código vencido';
  exception when sqlstate 'PV019' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'j: un código vencido no sirve'::text;

  -- (k) Con 5 intentos incorrectos el código se anula, aunque después llegue el correcto.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  select g.codigo into codigo from public.generar_codigo_ajuste(caja, 100) g;
  incorrecto := lpad(((codigo::integer + 1) % 1000000)::text, 6, '0');
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  for i in 1..5 loop
    if public.registrar_ajuste_caja(caja, 'ingreso', 1, 'Motivo', incorrecto) is not null then
      raise exception 'FAIL (k): aceptó un código incorrecto';
    end if;
  end loop;
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 1, 'Motivo', codigo);
    raise exception 'FAIL (k): el código siguió sirviendo después de 5 intentos';
  exception when sqlstate 'PV019' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'k: 5 intentos incorrectos anulan el código'::text;

  -- (l) El encargado usa un código en la caja de otro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  select g.codigo into codigo from public.generar_codigo_ajuste(caja_ajena, 50) g;
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  resultado := public.registrar_ajuste_caja(caja_ajena, 'ingreso', 50, 'Sobrante', codigo);
  execute 'reset role';
  if not exists (select 1 from public.caja_movimientos
                  where id = resultado and usuario_id = encargado and autorizado_por = dueno) then
    raise exception 'FAIL (l): el encargado no pudo ajustar con código';
  end if;
  ok := ok || 'l: el encargado ajusta la caja de otro con código'::text;

  -- (m) El dueño ajusta sin código y no queda autorizador.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resultado := public.registrar_ajuste_caja(caja, 'ingreso', 20, 'Ajuste del dueño');
  execute 'reset role';
  if not exists (select 1 from public.caja_movimientos
                  where id = resultado and usuario_id = dueno and autorizado_por is null) then
    raise exception 'FAIL (m): el dueño no pudo ajustar sin código';
  end if;
  ok := ok || 'm: el dueño ajusta sin código'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
