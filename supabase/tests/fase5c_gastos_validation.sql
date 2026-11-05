-- Validación de gastos (0020).
-- Necesita las migraciones 0001-0020 y el seed base (comercio "Kiosko Demo" y sus productos).
--
--   supabase db query --linked -f supabase/tests/fase5c_gastos_validation.sql
--
-- Un único bloque DO: crea sus usuarios y datos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000020a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000020a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000020a3';
  dueno_otro constant uuid := '00000000-0000-4000-8000-0000000020a5';
  comercio uuid;
  otro_comercio uuid;
  efectivo uuid;
  caja uuid;
  caja_cerrada uuid;
  gasto uuid;
  gasto_b uuid;
  conteos jsonb;
  filas integer;
  valor numeric;
  devuelto boolean;
  invalido record;
  ok text[] := '{}';
begin
  if to_regprocedure('public.anular_gasto(uuid)') is null then
    raise exception 'FAIL: faltan las funciones de gastos (aplicar la migración 0020)';
  end if;

  -- Fixtures (como postgres).
  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id into efectivo from public.medios_pago
   where comercio_id = comercio and tipo = 'efectivo' and activo order by orden limit 1;
  if comercio is null or efectivo is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  insert into public.comercios (nombre) values ('Otro comercio (test gastos)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.gasto@test.invalid'),
                 (encargado, 'encargado.gasto@test.invalid'),
                 (cajero, 'cajero.gasto@test.invalid'),
                 (dueno_otro, 'dueno.otro.gasto@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (dueno_otro, otro_comercio, 'dueno', 'Dueño de otro comercio (test)');

  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 1000) returning id into caja;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, encargado, 500) returning id into caja_cerrada;

  select jsonb_agg(jsonb_build_object('medio_pago_id', m.id, 'contado', 0))
    into conteos
    from public.medios_pago m
   where m.comercio_id = comercio and m.activo;

  -- (a) Por pagar: sin movimiento, y al pagarlo por fuera tampoco toca la caja.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  gasto := public.registrar_gasto('  Alquiler  ', 'fijo', 80000, date '2030-01-10', false);
  execute 'reset role';
  if not exists (
    select 1 from public.gastos
     where id = gasto and descripcion = 'Alquiler' and estado = 'por_pagar'
       and usuario_id = encargado and pagado_at is null
  ) then
    raise exception 'FAIL (a): el gasto por pagar no quedó como se cargó';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.pagar_gasto(gasto);
  execute 'reset role';
  if not exists (
    select 1 from public.gastos
     where id = gasto and estado = 'pagado' and pagado_por = dueno and pagado_at is not null
       and caja_id is null and caja_movimiento_id is null
  ) or exists (select 1 from public.caja_movimientos where caja_id in (caja, caja_cerrada)) then
    raise exception 'FAIL (a): pagar por fuera no quedó bien o tocó una caja';
  end if;
  ok := ok || 'a: por pagar y pagado por fuera no tocan la caja'::text;

  -- (b) Pagado con una caja abierta, aunque sea de otro: genera el retiro y queda enlazado.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  gasto_b := public.registrar_gasto('Flete', 'variable', 300, null, true, caja);
  execute 'reset role';
  if not exists (
    select 1 from public.gastos g
      join public.caja_movimientos m on m.id = g.caja_movimiento_id
     where g.id = gasto_b and g.estado = 'pagado' and g.caja_id = caja and m.caja_id = caja
       and m.tipo = 'retiro' and m.monto = 300 and m.motivo = 'Gasto: Flete' and m.usuario_id = dueno
  ) then
    raise exception 'FAIL (b): el gasto pagado con la caja no generó su retiro';
  end if;
  ok := ok || 'b: pagar con la caja genera el retiro enlazado'::text;

  -- (c) No se paga dos veces ni se genera un segundo retiro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    perform public.pagar_gasto(gasto_b, caja);
    raise exception 'FAIL (c): se pagó dos veces';
  exception when sqlstate 'PV017' then
    null;
  end;
  execute 'reset role';
  select count(*) into filas from public.caja_movimientos where caja_id = caja;
  if filas <> 1 then
    raise exception 'FAIL (c): hay % retiros en vez de 1', filas;
  end if;
  ok := ok || 'c: un gasto no se paga dos veces'::text;

  -- (d) Datos inválidos: rechazados, sin rastro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  select count(*) into filas from public.gastos where comercio_id = comercio;
  for invalido in
    select * from (values
      ('   ', 'fijo', 10::numeric, false, null::uuid),
      (null, 'fijo', 10::numeric, false, null::uuid),
      (repeat('x', 151), 'fijo', 10::numeric, false, null::uuid),
      ('Luz', 'otro', 10::numeric, false, null::uuid),
      ('Luz', 'fijo', 0::numeric, false, null::uuid),
      ('Luz', 'fijo', -1::numeric, false, null::uuid),
      ('Luz', 'fijo', 1.234::numeric, false, null::uuid),
      ('Luz', 'fijo', 10::numeric, null::boolean, null::uuid),
      ('Luz', 'fijo', 10::numeric, false, caja)
    ) as v (descripcion, tipo, monto, pagado, caja_id)
  loop
    begin
      perform public.registrar_gasto(invalido.descripcion, invalido.tipo, invalido.monto, null,
                                     invalido.pagado, invalido.caja_id);
      raise exception 'FAIL (d): se aceptó %', invalido;
    exception when sqlstate 'PV016' then
      null;
    end;
  end loop;
  if (select count(*) from public.gastos where comercio_id = comercio) <> filas then
    raise exception 'FAIL (d): un gasto inválido dejó rastro';
  end if;
  execute 'reset role';
  ok := ok || 'd: un gasto inválido no deja rastro'::text;

  -- (e) El cajero no ve ni opera gastos, tampoco con escritura directa.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  select count(*) into filas from public.gastos;
  if filas <> 0 then
    raise exception 'FAIL (e): el cajero ve % gastos', filas;
  end if;
  begin
    perform public.registrar_gasto('Luz', 'fijo', 10, null, false);
    raise exception 'FAIL (e): el cajero cargó un gasto';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.pagar_gasto(gasto, caja);
    raise exception 'FAIL (e): el cajero pagó un gasto';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.anular_gasto(gasto);
    raise exception 'FAIL (e): el cajero anuló un gasto';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.gasto_validar_rol();
    raise exception 'FAIL (e): la función interna quedó expuesta';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.gastos set monto = 1 where id = gasto;
    raise exception 'FAIL (e): update directo';
  exception when insufficient_privilege then
    null;
  end;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    delete from public.gastos where id = gasto;
    raise exception 'FAIL (e): el dueño borró un gasto directo';
  exception when insufficient_privilege then
    null;
  end;
  execute 'reset role';
  ok := ok || 'e: el cajero no accede y nadie escribe directo'::text;

  -- (f) Otro comercio no ve ni opera, ni paga con una caja ajena.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_otro, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.gastos where id = gasto) then
    raise exception 'FAIL (f): otro comercio ve el gasto';
  end if;
  begin
    perform public.anular_gasto(gasto);
    raise exception 'FAIL (f): otro comercio anuló el gasto';
  exception when sqlstate 'PV016' then
    null;
  end;
  begin
    perform public.registrar_gasto('Luz', 'fijo', 10, null, true, caja);
    raise exception 'FAIL (f): otro comercio pagó con una caja ajena';
  exception when sqlstate 'PV002' then
    null;
  end;
  execute 'reset role';
  if exists (select 1 from public.gastos where comercio_id = otro_comercio) then
    raise exception 'FAIL (f): el pago rechazado dejó el gasto cargado';
  end if;
  ok := ok || 'f: un comercio no ve ni opera gastos o cajas de otro'::text;

  -- (g) Con una caja cerrada no se paga: el gasto sigue por pagar.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  gasto := public.registrar_gasto('Pago con caja propia', 'variable', 200, null, true, caja_cerrada);
  perform public.cerrar_caja(caja_cerrada, conteos);
  gasto_b := public.registrar_gasto('Luz', 'fijo', 150, null, false);
  begin
    perform public.pagar_gasto(gasto_b, caja_cerrada);
    raise exception 'FAIL (g): se pagó con una caja cerrada';
  exception when sqlstate 'PV012' then
    null;
  end;
  execute 'reset role';
  if (select estado from public.gastos where id = gasto_b) <> 'por_pagar' then
    raise exception 'FAIL (g): el gasto no siguió por pagar';
  end if;
  select esperado into valor from public.caja_cierres
   where caja_id = caja_cerrada and medio_pago_id = efectivo;
  if valor is distinct from 300::numeric then
    raise exception 'FAIL (g): efectivo esperado % en vez de 300', valor;
  end if;
  ok := ok || 'g: el esperado descuenta el gasto y una caja cerrada no paga'::text;

  -- (h) Anular: por pagar, sin movimiento. Con caja cerrada, sin tocar el arqueo.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  devuelto := public.anular_gasto(gasto_b);
  if devuelto then
    raise exception 'FAIL (h): un gasto por pagar devolvió plata';
  end if;
  devuelto := public.anular_gasto(gasto);
  if devuelto then
    raise exception 'FAIL (h): se devolvió plata a una caja cerrada';
  end if;
  begin
    perform public.anular_gasto(gasto);
    raise exception 'FAIL (h): se anuló dos veces';
  exception when sqlstate 'PV017' then
    null;
  end;
  begin
    perform public.pagar_gasto(gasto_b);
    raise exception 'FAIL (h): se pagó un gasto anulado';
  exception when sqlstate 'PV017' then
    null;
  end;
  execute 'reset role';
  select count(*) into filas from public.caja_movimientos
   where caja_id = caja_cerrada and tipo = 'ingreso';
  if filas <> 0 then
    raise exception 'FAIL (h): la caja cerrada recibió un ingreso';
  end if;
  ok := ok || 'h: anular no toca una caja cerrada ni se repite'::text;

  -- (i) Anular con la caja abierta devuelve la plata: el esperado queda como si no hubiera gasto.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  gasto := public.registrar_gasto('Error de carga', 'variable', 400, null, true, caja);
  devuelto := public.anular_gasto(gasto);
  if not devuelto then
    raise exception 'FAIL (i): no se devolvió la plata a la caja abierta';
  end if;
  perform public.cerrar_caja(caja, conteos);
  execute 'reset role';
  -- Fondo 1000 - Flete 300 - Error 400 + devolución 400.
  select esperado into valor from public.caja_cierres
   where caja_id = caja and medio_pago_id = efectivo;
  if valor is distinct from 700::numeric then
    raise exception 'FAIL (i): efectivo esperado % en vez de 700', valor;
  end if;
  if (select estado from public.gastos where id = gasto) <> 'anulado' then
    raise exception 'FAIL (i): el gasto no quedó anulado';
  end if;
  ok := ok || 'i: anular con la caja abierta devuelve la plata'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
