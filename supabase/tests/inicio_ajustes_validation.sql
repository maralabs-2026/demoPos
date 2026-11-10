-- Validación de la actividad reciente con ajustes (0041).
-- Necesita las migraciones hasta 0041 y el seed base (comercio "Kiosko Demo").
--
--   supabase db query --linked -f supabase/tests/inicio_ajustes_validation.sql
--
-- Un único bloque DO: crea sus datos y SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)"
-- para no dejar rastro. Los roles se simulan como PostgREST. Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000041a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000041a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000041a3';
  comercio uuid;
  caja uuid;
  codigo text;
  actividad jsonb;
  fila jsonb;
  ok text[] := '{}';
begin
  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.inicio41@test.invalid'),
                 (encargado, 'encargado.inicio41@test.invalid'),
                 (cajero, 'cajero.inicio41@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño 41 (test)'),
    (encargado, comercio, 'encargado', 'Encargado 41 (test)'),
    (cajero, comercio, 'cajero', 'Cajero 41 (test)');
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 0) returning id into caja;

  execute 'set local role authenticated';
  -- Un retiro común del cajero, un ajuste del dueño sin código y uno del encargado con código.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.registrar_movimiento_caja(caja, 'retiro', 25, 'Retiro comun 41');
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.registrar_ajuste_caja(caja, 'ingreso', 200, 'Ajuste dueno 41');
  select g.codigo into codigo from public.generar_codigo_ajuste(caja, 100) g;
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  perform public.registrar_ajuste_caja(caja, 'retiro', 50, 'Ajuste con codigo 41', codigo);

  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  actividad := public.inicio_resumen() -> 'actividad';
  execute 'reset role';

  -- (a) Un retiro común sigue saliendo como retiro, sin autorizador.
  select x into fila from jsonb_array_elements(actividad) x where x ->> 'detalle' = 'Retiro comun 41';
  if fila is null or fila ->> 'tipo' <> 'retiro' or fila ->> 'autorizo' is not null then
    raise exception 'FAIL (a): %', fila;
  end if;
  ok := ok || 'a: un retiro común sigue siendo retiro'::text;

  -- (b) El ajuste del dueño sale como ajuste de ingreso, sin autorizador.
  select x into fila from jsonb_array_elements(actividad) x where x ->> 'detalle' = 'Ajuste dueno 41';
  if fila is null or fila ->> 'tipo' <> 'ajuste_ingreso' or fila ->> 'autorizo' is not null
     or (fila ->> 'monto')::numeric <> 200 then
    raise exception 'FAIL (b): %', fila;
  end if;
  ok := ok || 'b: el ajuste del dueño sale como ajuste, sin autorizador'::text;

  -- (c) El ajuste con código sale como ajuste de retiro, con quién lo cargó y quién lo autorizó.
  select x into fila from jsonb_array_elements(actividad) x where x ->> 'detalle' = 'Ajuste con codigo 41';
  if fila is null or fila ->> 'tipo' <> 'ajuste_retiro' or fila ->> 'usuario' <> 'Encargado 41 (test)'
     or fila ->> 'autorizo' <> 'Dueño 41 (test)' then
    raise exception 'FAIL (c): %', fila;
  end if;
  ok := ok || 'c: el ajuste con código lleva quién lo autorizó'::text;

  -- (d) Las demás entradas traen el campo, en null.
  if exists (select 1 from jsonb_array_elements(actividad) x where not x ? 'autorizo') then
    raise exception 'FAIL (d): hay entradas sin el campo autorizo';
  end if;
  ok := ok || 'd: todas las entradas traen autorizo'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
