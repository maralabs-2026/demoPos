-- Validación de retiros e ingresos de caja (0019).
-- Necesita las migraciones 0001-0019 y el seed base (comercio "Kiosko Demo" y sus productos).
--
--   supabase db query --linked -f supabase/tests/fase5b_movimientos_caja_validation.sql
--
-- Un único bloque DO: crea sus usuarios y datos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  encargado constant uuid := '00000000-0000-4000-8000-0000000019a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000019a3';
  otro_cajero constant uuid := '00000000-0000-4000-8000-0000000019a4';
  dueno_otro constant uuid := '00000000-0000-4000-8000-0000000019a5';
  comercio uuid;
  otro_comercio uuid;
  coca uuid;
  precio numeric;
  efectivo uuid;
  tarjeta uuid;
  caja uuid;
  caja_ajena uuid;
  movimiento uuid;
  conteos jsonb;
  conteos_ajena jsonb;
  filas integer;
  valor numeric;
  invalido record;
  ok text[] := '{}';
begin
  if to_regprocedure('public.registrar_movimiento_caja(uuid, text, numeric, text)') is null then
    raise exception 'FAIL: falta registrar_movimiento_caja (aplicar la migración 0019)';
  end if;

  -- Fixtures (como postgres).
  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id, productos.precio into coca, precio from public.productos
   where comercio_id = comercio and codigo_barras = '7790010000154';
  select id into efectivo from public.medios_pago
   where comercio_id = comercio and tipo = 'efectivo' and activo order by orden limit 1;
  select id into tarjeta from public.medios_pago
   where comercio_id = comercio and tipo = 'tarjeta' and activo order by orden limit 1;
  if comercio is null or coca is null or efectivo is null or tarjeta is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  update public.promociones set activa = false where comercio_id = comercio;
  update public.combos set activa = false where comercio_id = comercio;

  insert into public.comercios (nombre) values ('Otro comercio (test movimientos)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (encargado, 'encargado.mov@test.invalid'),
                 (cajero, 'cajero.mov@test.invalid'),
                 (otro_cajero, 'otro.mov@test.invalid'),
                 (dueno_otro, 'dueno.otro.mov@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (otro_cajero, comercio, 'cajero', 'Otro cajero (test)'),
    (dueno_otro, otro_comercio, 'dueno', 'Dueño de otro comercio (test)');

  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, coca, 'ajuste', 20, 'Validación movimientos', encargado);

  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 1000) returning id into caja;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, otro_cajero, 200) returning id into caja_ajena;

  select jsonb_agg(jsonb_build_object('medio_pago_id', m.id, 'contado', 0))
    into conteos
    from public.medios_pago m
   where m.comercio_id = comercio and m.activo;
  conteos_ajena := conteos;

  -- (a) El cajero registra en su caja: queda quién fue y el motivo sin espacios de más.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', precio)));
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', tarjeta, 'monto', precio)));
  movimiento := public.registrar_movimiento_caja(caja, 'retiro', 300, '  Pago al proveedor  ');
  perform public.registrar_movimiento_caja(caja, 'ingreso', 50.25, 'Cambio del banco');
  execute 'reset role';

  if not exists (
    select 1 from public.caja_movimientos
     where id = movimiento and caja_id = caja and comercio_id = comercio and usuario_id = cajero
       and tipo = 'retiro' and monto = 300 and motivo = 'Pago al proveedor'
  ) then
    raise exception 'FAIL (a): el retiro no quedó como se registró';
  end if;
  ok := ok || 'a: el cajero registra retiros e ingresos en su caja'::text;

  -- (b) Datos inválidos: rechazados, sin rastro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  for invalido in
    select * from (values
      ('retiro', 0::numeric, 'Motivo'),
      ('retiro', -1::numeric, 'Motivo'),
      ('retiro', 10.123::numeric, 'Motivo'),
      ('retiro', 10000000000::numeric, 'Motivo'),
      ('retiro', null::numeric, 'Motivo'),
      ('gasto', 10::numeric, 'Motivo'),
      (null, 10::numeric, 'Motivo'),
      ('retiro', 10::numeric, '   '),
      ('retiro', 10::numeric, null),
      ('retiro', 10::numeric, repeat('x', 201))
    ) as v (tipo, monto, motivo)
  loop
    begin
      perform public.registrar_movimiento_caja(caja, invalido.tipo, invalido.monto, invalido.motivo);
      raise exception 'FAIL (b): se aceptó % / % / %', invalido.tipo, invalido.monto, invalido.motivo;
    exception when sqlstate 'PV015' then
      null;
    end;
  end loop;
  execute 'reset role';
  select count(*) into filas from public.caja_movimientos where caja_id = caja;
  if filas <> 2 then
    raise exception 'FAIL (b): hay % movimientos en vez de 2', filas;
  end if;
  ok := ok || 'b: un movimiento inválido no deja rastro'::text;

  -- (c) Solo se escribe con la función: ni insert, ni update, ni delete directos.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    insert into public.caja_movimientos (caja_id, comercio_id, usuario_id, tipo, monto, motivo)
    values (caja, comercio, cajero, 'ingreso', 1, 'x');
    raise exception 'FAIL (c): insert directo';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.caja_movimientos set monto = 1 where id = movimiento;
    raise exception 'FAIL (c): update directo';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.caja_movimientos where id = movimiento;
    raise exception 'FAIL (c): delete directo';
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'c: un movimiento no se escribe, edita ni borra a mano'::text;

  -- (d) Un cajero no opera ni lee la caja de otro.
  begin
    perform public.registrar_movimiento_caja(caja_ajena, 'retiro', 10, 'Motivo');
    raise exception 'FAIL (d): un cajero registró en la caja de otro';
  exception when sqlstate 'PV002' then
    null;
  end;
  execute 'reset role';

  -- (e) El encargado registra en la caja de otro, sin límite por lo que hay en el cajón.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  movimiento := public.registrar_movimiento_caja(caja_ajena, 'retiro', 500, 'Retiro del encargado');
  if not exists (select 1 from public.caja_movimientos where caja_id = caja) then
    raise exception 'FAIL (e): el encargado no ve los movimientos del comercio';
  end if;
  execute 'reset role';
  if (select usuario_id from public.caja_movimientos where id = movimiento)
     is distinct from encargado then
    raise exception 'FAIL (e): no quedó registrado quién hizo el retiro';
  end if;
  ok := ok || 'e: el encargado opera una caja ajena y queda registrado'::text;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  select count(*) into filas from public.caja_movimientos where caja_id = caja_ajena;
  if filas <> 0 then
    raise exception 'FAIL (d): un cajero ve % movimientos de otra caja', filas;
  end if;
  ok := ok || 'd: un cajero no opera ni lee la caja de otro'::text;

  -- (f) Otro comercio no ve ni opera.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_otro, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.caja_movimientos where caja_id = caja) then
    raise exception 'FAIL (f): otro comercio ve los movimientos';
  end if;
  begin
    perform public.registrar_movimiento_caja(caja, 'retiro', 10, 'Motivo');
    raise exception 'FAIL (f): otro comercio registró un movimiento';
  exception when sqlstate 'PV002' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'f: un comercio no ve ni opera los movimientos de otro'::text;

  -- (g) El efectivo esperado: fondo + ventas en efectivo + ingresos - retiros. La tarjeta, igual.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.cerrar_caja(caja, conteos);
  execute 'reset role';

  select esperado into valor from public.caja_cierres
   where caja_id = caja and medio_pago_id = efectivo;
  if valor is distinct from 1000 + precio + 50.25 - 300 then
    raise exception 'FAIL (g): efectivo esperado % en vez de %', valor, 1000 + precio + 50.25 - 300;
  end if;
  select esperado into valor from public.caja_cierres
   where caja_id = caja and medio_pago_id = tarjeta;
  if valor is distinct from precio then
    raise exception 'FAIL (g): tarjeta esperada % en vez de %', valor, precio;
  end if;
  ok := ok || 'g: el esperado de efectivo suma ingresos y resta retiros'::text;

  -- (h) Un retiro mayor a lo disponible deja el esperado negativo y el cierre sigue funcionando.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  perform public.cerrar_caja(caja_ajena, conteos_ajena);
  execute 'reset role';
  select esperado into valor from public.caja_cierres
   where caja_id = caja_ajena and medio_pago_id = efectivo;
  if valor is distinct from -300::numeric then
    raise exception 'FAIL (h): efectivo esperado % en vez de -300', valor;
  end if;
  ok := ok || 'h: un retiro alto no traba el cierre'::text;

  -- (i) Sobre una caja cerrada no se registra nada.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_movimiento_caja(caja, 'ingreso', 10, 'Motivo');
    raise exception 'FAIL (i): se registró sobre una caja cerrada';
  exception when sqlstate 'PV012' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'i: una caja cerrada no admite movimientos'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
