-- Validación del cierre de caja (0018).
-- Necesita las migraciones 0001-0018 y el seed base (comercio "Kiosko Demo" y sus productos).
--
--   supabase db query --linked -f supabase/tests/fase5a_cierre_caja_validation.sql
--
-- Un único bloque DO: crea sus usuarios y datos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000018a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000018a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000018a3';
  otro_cajero constant uuid := '00000000-0000-4000-8000-0000000018a4';
  dueno_otro constant uuid := '00000000-0000-4000-8000-0000000018a5';
  comercio uuid;
  otro_comercio uuid;
  coca uuid;
  precio numeric;
  efectivo uuid;
  tarjeta uuid;
  retirado uuid;
  caja uuid;
  caja_ajena uuid;
  venta_anulada uuid;
  conteos jsonb;
  conteos_ajena jsonb;
  resultado jsonb;
  filas integer;
  valor numeric;
  ok text[] := '{}';
begin
  if to_regprocedure('public.cerrar_caja(uuid, jsonb, text)') is null then
    raise exception 'FAIL: falta cerrar_caja (aplicar la migración 0018)';
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

  insert into public.comercios (nombre) values ('Otro comercio (test caja)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.caja@test.invalid'),
                 (encargado, 'encargado.caja@test.invalid'),
                 (cajero, 'cajero.caja@test.invalid'),
                 (otro_cajero, 'otro.caja@test.invalid'),
                 (dueno_otro, 'dueno.otro.caja@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (otro_cajero, comercio, 'cajero', 'Otro cajero (test)'),
    (dueno_otro, otro_comercio, 'dueno', 'Dueño de otro comercio (test)');

  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, coca, 'ajuste', 20, 'Validación caja', dueno);

  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 1000) returning id into caja;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, otro_cajero, 200) returning id into caja_ajena;

  -- Medio retirado: no está activo, pero tuvo una venta en esta caja, así que hay que contarlo.
  insert into public.medios_pago (comercio_id, nombre, tipo, orden)
  values (comercio, 'Medio retirado (test)', 'transferencia', 99) returning id into retirado;

  -- Ventas: una en efectivo, una con tarjeta, una con el medio retirado y una que se anula.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', precio)));
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', tarjeta, 'monto', precio * 2)));
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', retirado, 'monto', precio)));
  resultado := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', precio)));
  venta_anulada := (resultado ->> 'venta_id')::uuid;
  execute 'reset role';

  update public.ventas set estado = 'anulada' where id = venta_anulada;
  update public.medios_pago set activo = false where id = retirado;

  -- Conteo de la caja: faltan $ 100 de efectivo y el resto cuadra (cero en los medios sin ventas).
  select jsonb_agg(jsonb_build_object(
           'medio_pago_id', m.id,
           'contado', case when m.id = efectivo then 1000 + precio - 100
                           when m.id = tarjeta then precio * 2
                           when m.id = retirado then precio
                           else 0 end))
    into conteos
    from public.medios_pago m
   where m.comercio_id = comercio and (m.activo or m.id = retirado);

  select jsonb_agg(jsonb_build_object(
           'medio_pago_id', m.id,
           'contado', case when m.id = efectivo then 200 else 0 end))
    into conteos_ajena
    from public.medios_pago m
   where m.comercio_id = comercio and m.activo;

  -- (a) Lo que hay que contar no trae montos e incluye el medio retirado.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.caja_medios_a_contar(caja) where medio_pago_id = retirado) then
    raise exception 'FAIL (a): falta el medio inactivo con ventas';
  end if;
  begin
    perform public.caja_esperado_por_medio(caja);
    raise exception 'FAIL (a): el cajero pudo leer el esperado antes de contar';
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'a: el cajero sabe qué contar, sin ver el esperado'::text;

  -- (b) Un update directo ya no cierra la caja, ni se escribe el cierre a mano.
  begin
    update public.cajas set estado = 'cerrada', cerrada_at = now() where id = caja;
    raise exception 'FAIL (b): el cajero pudo intentar cerrar con un update directo';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.caja_cierres (caja_id, comercio_id, medio_pago_id, nombre, esperado, contado)
    values (caja, comercio, efectivo, 'x', 0, 0);
    raise exception 'FAIL (b): el cajero pudo intentar escribir el cierre';
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'b: solo se cierra con cerrar_caja'::text;

  -- (c) Conteos inválidos: rechazados, y la caja sigue abierta sin rastro.
  begin
    perform public.cerrar_caja(caja, '[]'::jsonb);
    raise exception 'FAIL (c): se cerró sin conteo';
  exception when sqlstate 'PV014' then
    null;
  end;
  begin
    perform public.cerrar_caja(caja, conteos || jsonb_build_array(jsonb_build_object(
      'medio_pago_id', efectivo, 'contado', 1)));
    raise exception 'FAIL (c): se aceptó un medio contado dos veces';
  exception when sqlstate 'PV014' then
    null;
  end;
  begin
    perform public.cerrar_caja(caja, jsonb_build_array(jsonb_build_object(
      'medio_pago_id', efectivo, 'contado', -1)));
    raise exception 'FAIL (c): se aceptó un conteo negativo';
  exception when sqlstate 'PV014' then
    null;
  end;
  begin
    perform public.cerrar_caja(caja, conteos || jsonb_build_array(jsonb_build_object(
      'medio_pago_id', gen_random_uuid(), 'contado', 0)));
    raise exception 'FAIL (c): se aceptó un medio que no corresponde';
  exception when sqlstate 'PV014' then
    null;
  end;
  execute 'reset role';
  if exists (select 1 from public.caja_cierres where caja_id = caja)
     or (select estado from public.cajas where id = caja) <> 'abierta' then
    raise exception 'FAIL (c): un conteo rechazado dejó rastro';
  end if;
  ok := ok || 'c: un conteo inválido no deja rastro'::text;

  -- (d) Un cajero no cierra la caja de otro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.cerrar_caja(caja_ajena, conteos_ajena);
    raise exception 'FAIL (d): un cajero cerró la caja de otro';
  exception when sqlstate 'PV002' then
    null;
  end;
  begin
    perform 1 from public.caja_medios_a_contar(caja_ajena);
    raise exception 'FAIL (d): un cajero leyó qué contar en la caja de otro';
  exception when sqlstate 'PV002' then
    null;
  end;
  ok := ok || 'd: un cajero no opera la caja de otro'::text;

  -- (e) El cajero cierra la suya: esperado con fondo, sin la venta anulada, y diferencia.
  resultado := public.cerrar_caja(caja, conteos, '  Faltó cambio  ');
  execute 'reset role';

  select esperado into valor from public.caja_cierres
   where caja_id = caja and medio_pago_id = efectivo;
  if valor is distinct from 1000 + precio then
    raise exception 'FAIL (e): efectivo esperado % en vez de %', valor, 1000 + precio;
  end if;
  select diferencia into valor from public.caja_cierres
   where caja_id = caja and medio_pago_id = efectivo;
  if valor is distinct from -100::numeric then
    raise exception 'FAIL (e): diferencia de efectivo %', valor;
  end if;
  select esperado into valor from public.caja_cierres
   where caja_id = caja and medio_pago_id = tarjeta;
  if valor is distinct from precio * 2 then
    raise exception 'FAIL (e): tarjeta esperada %', valor;
  end if;
  if not exists (
    select 1 from public.cajas
     where id = caja and estado = 'cerrada' and cerrada_at is not null
       and cerrada_por = cajero and nota_cierre = 'Faltó cambio'
  ) then
    raise exception 'FAIL (e): la caja no quedó cerrada con quien la cerró y su nota';
  end if;
  if jsonb_array_length(resultado -> 'lineas') <> jsonb_array_length(conteos) then
    raise exception 'FAIL (e): el resultado no trae todas las líneas: %', resultado;
  end if;
  ok := ok || 'e: el esperado suma fondo y ventas, sin anuladas'::text;

  -- (f) No se cierra dos veces, y no se vende sobre una caja cerrada.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.cerrar_caja(caja, conteos);
    raise exception 'FAIL (f): se cerró dos veces';
  exception when sqlstate 'PV012' then
    null;
  end;
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', precio)));
    raise exception 'FAIL (f): se vendió sobre una caja cerrada';
  exception when sqlstate 'PV002' then
    null;
  end;
  ok := ok || 'f: una caja cerrada no se cierra ni vende'::text;

  -- (g) El cajero lee su cierre, no el de otro.
  select count(*) into filas from public.caja_cierres where caja_id = caja;
  if filas = 0 then
    raise exception 'FAIL (g): el cajero no ve su cierre';
  end if;
  execute 'reset role';

  -- (h) El encargado cierra la caja que otro dejó abierta, y queda registrado.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  perform public.cerrar_caja(caja_ajena, conteos_ajena);
  execute 'reset role';
  if (select cerrada_por from public.cajas where id = caja_ajena) is distinct from encargado then
    raise exception 'FAIL (h): no quedó registrado quién cerró';
  end if;
  ok := ok || 'h: el encargado cierra una caja ajena y queda registrado'::text;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  select count(*) into filas from public.caja_cierres where caja_id = caja_ajena;
  if filas <> 0 then
    raise exception 'FAIL (g): un cajero ve % líneas del cierre de otro', filas;
  end if;
  ok := ok || 'g: el cajero ve su cierre, no el de otro'::text;

  -- (i) El dueño lee todo su comercio; el de otro comercio, nada.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.caja_cierres where caja_id = caja_ajena) then
    raise exception 'FAIL (i): el dueño no ve el cierre';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_otro, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.caja_cierres where caja_id = caja) then
    raise exception 'FAIL (i): otro comercio ve el cierre';
  end if;
  begin
    perform public.cerrar_caja(caja_ajena, conteos_ajena);
    raise exception 'FAIL (i): otro comercio pudo operar la caja';
  exception when sqlstate 'PV002' then
    null;
  end;
  execute 'reset role';
  ok := ok || 'i: un comercio no ve ni opera las cajas de otro'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
