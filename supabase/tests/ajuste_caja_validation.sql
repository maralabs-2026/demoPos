-- Validación del ajuste de caja (0039).
-- Necesita las migraciones hasta 0039 (desde 0040, el caso a espera PV019) y el seed base (comercio "Kiosko Demo").
--
--   supabase db query --linked -f supabase/tests/ajuste_caja_validation.sql
--
-- Un único bloque DO: crea sus datos y SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)"
-- para no dejar rastro. Los roles se simulan como PostgREST. Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000039a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000039a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000039a3';
  dueno_otro constant uuid := '00000000-0000-4000-8000-0000000039a4';
  comercio uuid;
  otro_comercio uuid;
  efectivo uuid;
  caja uuid;
  ajuste uuid;
  conteos jsonb;
  filas integer;
  valor numeric;
  ok text[] := '{}';
begin
  if to_regproc('public.registrar_ajuste_caja') is null then
    raise exception 'FAIL: falta registrar_ajuste_caja (aplicar la migración 0039)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id into efectivo from public.medios_pago
   where comercio_id = comercio and tipo = 'efectivo' and activo order by orden limit 1;
  if comercio is null or efectivo is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  insert into public.comercios (nombre) values ('Otro comercio (test ajuste)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.ajuste@test.invalid'),
                 (encargado, 'encargado.ajuste@test.invalid'),
                 (cajero, 'cajero.ajuste@test.invalid'),
                 (dueno_otro, 'dueno.otro.ajuste@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (dueno_otro, otro_comercio, 'dueno', 'Dueño de otro comercio (test)');

  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 1000) returning id into caja;

  select jsonb_agg(jsonb_build_object('medio_pago_id', m.id, 'contado', 0))
    into conteos
    from public.medios_pago m
   where m.comercio_id = comercio and m.activo;

  -- (a) Encargado y cajero no ajustan, ni siquiera el cajero en su propia caja. Desde 0040 lo
  -- hacen solo con un código del dueño: sin código vigente, PV019.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 10, 'Motivo');
    raise exception 'FAIL (a): el encargado ajustó';
  exception when sqlstate 'PV019' then
    null;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 10, 'Motivo');
    raise exception 'FAIL (a): el cajero ajustó';
  exception when sqlstate 'PV019' then
    null;
  end;
  execute 'reset role';
  select count(*) into filas from public.caja_movimientos where caja_id = caja;
  if filas <> 0 then
    raise exception 'FAIL (a): quedaron % movimientos', filas;
  end if;
  ok := ok || 'a: encargado y cajero no ajustan'::text;

  -- (b) El dueño de otro comercio no opera esta caja.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_otro, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 10, 'Motivo');
    raise exception 'FAIL (b): otro comercio ajustó';
  exception when sqlstate 'PV002' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'b: un dueño no ajusta la caja de otro comercio'::text;

  -- (c) Datos inválidos.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 0, 'Motivo');
    raise exception 'FAIL (c): se aceptó monto cero';
  exception when sqlstate 'PV015' then
    null;
  end;
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 10, '   ');
    raise exception 'FAIL (c): se aceptó un motivo vacío';
  exception when sqlstate 'PV015' then
    null;
  end;
  ok := ok || 'c: un ajuste inválido se rechaza'::text;

  -- (d) El dueño ajusta una caja ajena: queda marcado y con su autor.
  ajuste := public.registrar_ajuste_caja(caja, 'ingreso', 200, '  Diferencia detectada  ');
  perform public.registrar_ajuste_caja(caja, 'retiro', 50, 'Corrección');
  execute 'reset role';
  if not exists (
    select 1 from public.caja_movimientos
     where id = ajuste and usuario_id = dueno and es_ajuste and tipo = 'ingreso'
       and monto = 200 and motivo = 'Diferencia detectada'
  ) then
    raise exception 'FAIL (d): el ajuste no quedó como se registró';
  end if;
  ok := ok || 'd: el dueño ajusta y queda registrado'::text;

  -- (e) Un retiro común no queda marcado como ajuste.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  ajuste := public.registrar_movimiento_caja(caja, 'retiro', 25, 'Retiro común');
  execute 'reset role';
  if (select es_ajuste from public.caja_movimientos where id = ajuste) then
    raise exception 'FAIL (e): un retiro común quedó como ajuste';
  end if;
  ok := ok || 'e: un retiro común no es ajuste'::text;

  -- (f) Los ajustes entran en el esperado: 1000 + 200 - 50 - 25.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.cerrar_caja(caja, conteos);
  execute 'reset role';
  select esperado into valor from public.caja_cierres
   where caja_id = caja and medio_pago_id = efectivo;
  if valor is distinct from 1125::numeric then
    raise exception 'FAIL (f): efectivo esperado % en vez de 1125', valor;
  end if;
  ok := ok || 'f: el ajuste entra en el esperado'::text;

  -- (g) Una caja cerrada no se ajusta.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_ajuste_caja(caja, 'ingreso', 10, 'Motivo');
    raise exception 'FAIL (g): se ajustó una caja cerrada';
  exception when sqlstate 'PV012' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'g: una caja cerrada no se ajusta'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
