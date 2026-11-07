-- Validación de los códigos internos (0027).
-- Necesita las migraciones 0001-0027. Crea sus propios comercios para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/codigo_interno_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000027a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000027a2';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000027a3';
  comercio uuid;
  otro uuid;
  codigo text;
  ok text[] := '{}';
begin
  if to_regprocedure('public.siguiente_codigo_interno()') is null then
    raise exception 'FAIL: falta siguiente_codigo_interno (aplicar la migración 0027)';
  end if;

  insert into public.comercios (nombre) values ('Comercio códigos (test)') returning id into comercio;
  insert into public.comercios (nombre) values ('Otro comercio códigos (test)') returning id into otro;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
          'dueno.codigos@test.invalid', '{}', '{}', now(), now()),
         ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
          'cajero.codigos@test.invalid', '{}', '{}', now(), now()),
         ('00000000-0000-0000-0000-000000000000', otro_dueno, 'authenticated', 'authenticated',
          'otro.codigos@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'),
         (cajero, comercio, 'cajero', 'Cajero (test)'),
         (otro_dueno, otro, 'dueno', 'Otro dueño (test)');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);

  -- (a) El primer código es 20 + 0000000001 + dígito verificador.
  codigo := public.siguiente_codigo_interno();
  if codigo <> '2000000000015' then
    raise exception 'FAIL (a): primer código = %', codigo;
  end if;
  ok := ok || 'a: primer código EAN-13 válido'::text;

  -- (b) El siguiente es correlativo.
  codigo := public.siguiente_codigo_interno();
  if codigo <> '2000000000022' then
    raise exception 'FAIL (b): segundo código = %', codigo;
  end if;
  ok := ok || 'b: correlativo'::text;

  -- (c) Si un producto ya tiene un código interno más alto (cargado a mano), sigue después de ese,
  -- aunque el contador haya quedado atrás.
  execute 'reset role';
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Taza (test)', '2000000000053', 1000);
  update public.configuracion set valor = '0'
   where comercio_id = comercio and clave = 'codigo_interno_ultimo';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  codigo := public.siguiente_codigo_interno();
  if codigo <> '2000000000060' then
    raise exception 'FAIL (c): después de un código cargado a mano = %', codigo;
  end if;
  ok := ok || 'c: saltea los códigos ya usados'::text;

  -- (d) El cajero no puede generar códigos.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    codigo := public.siguiente_codigo_interno();
    raise exception 'FAIL (d): el cajero generó %', codigo;
  exception when insufficient_privilege then
    ok := ok || 'd: el cajero no genera códigos'::text;
  end;

  -- (e) Cada comercio tiene su propia numeración.
  perform set_config('request.jwt.claims',
    json_build_object('sub', otro_dueno, 'role', 'authenticated')::text, true);
  codigo := public.siguiente_codigo_interno();
  if codigo <> '2000000000015' then
    raise exception 'FAIL (e): primer código del otro comercio = %', codigo;
  end if;
  ok := ok || 'e: numeración por comercio'::text;

  -- (f) Sin perfil (anon con JWT de otro usuario) no hay código.
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-0000000027ff', 'role', 'authenticated')::text, true);
  begin
    codigo := public.siguiente_codigo_interno();
    raise exception 'FAIL (f): sin perfil generó %', codigo;
  exception when insufficient_privilege then
    ok := ok || 'f: sin perfil no genera'::text;
  end;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
