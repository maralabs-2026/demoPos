-- Validación de la Fase 4c: descuentos por ítem y sobre el total según el rol (0012).
-- Necesita las migraciones 0001-0012 y el seed base (comercio "Kiosko Demo" y sus productos).
--
--   supabase db query --linked -f supabase/tests/fase4_descuentos_validation.sql
--
-- Es un único bloque DO: crea sus usuarios y cajas de prueba y, al terminar, SIEMPRE aborta con
-- una excepción para revertir todo. Resultado en el mensaje: "VALIDACION OK (todo revertido)"
-- o "FAIL: ..." en la primera falla. Los roles se simulan como PostgREST (SET ROLE + claims).

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000007d1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000007c3';
  comercio uuid;
  coca uuid;
  precio numeric;
  efectivo uuid;
  caja_dueno uuid;
  caja_cajero uuid;
  resultado jsonb;
  ventas_antes integer;
  ok text[] := '{}';
begin
  -- -------------------------------------------------------------------------------------------
  -- Fixtures (como postgres)
  -- -------------------------------------------------------------------------------------------
  if not exists (
    select 1 from information_schema.columns
     where table_name = 'venta_items' and column_name = 'descuento'
  ) then
    raise exception 'FAIL: falta venta_items.descuento (aplicar la migración 0012)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id, productos.precio into coca, precio
    from public.productos where comercio_id = comercio and codigo_barras = '7790010000154';
  select id into efectivo
    from public.medios_pago where comercio_id = comercio and tipo = 'efectivo' and activo limit 1;
  if comercio is null or coca is null or efectivo is null then
    raise exception 'FAIL: faltan el comercio, la Coca-Cola o el medio efectivo (correr el seed)';
  end if;
  if precio <> 2500 then
    raise exception 'FAIL: el script asume la Coca-Cola a $ 2.500 (tiene %)', precio;
  end if;

  -- El tope arranca en 10 %, como deja la migración.
  update public.configuracion set valor = '10'::jsonb
   where comercio_id = comercio and clave = 'descuento_max_cajero_pct';

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
     'dueno.desc@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
     'cajero.desc@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)');
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, dueno, 0) returning id into caja_dueno;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 0) returning id into caja_cajero;

  -- -------------------------------------------------------------------------------------------
  -- (a) Cajero dentro del tope
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  -- 2 Coca a $ 2.500 con 10 % = $ 5.000 - $ 500 = $ 4.500.
  resultado := public.registrar_venta(
    caja_cajero,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2, 'descuento_pct', 10)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 4500)));
  execute 'reset role';
  if (resultado ->> 'total')::numeric <> 4500
     or (select descuento from public.venta_items where venta_id = (resultado ->> 'venta_id')::uuid) <> 500
     or (select subtotal from public.venta_items where venta_id = (resultado ->> 'venta_id')::uuid) <> 4500 then
    raise exception 'FAIL: el 10 %% por ítem del cajero no dio $ 4.500 con $ 500 de descuento (%)', resultado;
  end if;
  ok := array_append(ok, 'el cajero descuenta 10 % por ítem y queda guardado como snapshot');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  -- Ítem al 10 % ($ 4.500 neto) y 5 % sobre el total ($ 225) = $ 4.275.
  resultado := public.registrar_venta(
    caja_cajero,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2, 'descuento_pct', 10)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 4275, 'recibido', 5000)),
    5);
  execute 'reset role';
  if (resultado ->> 'total')::numeric <> 4275 or (resultado ->> 'descuento')::numeric <> 225
     or (resultado ->> 'vuelto')::numeric <> 725
     or (select descuento from public.ventas where id = (resultado ->> 'venta_id')::uuid) <> 225 then
    raise exception 'FAIL: descuento por ítem y sobre el total dio %', resultado;
  end if;
  ok := array_append(ok, 'descuento por ítem y sobre el total se combinan: $ 4.275 con vuelto $ 725');

  -- -------------------------------------------------------------------------------------------
  -- (b) Cajero fuera del tope: falla sin dejar rastro
  -- -------------------------------------------------------------------------------------------
  select count(*) into ventas_antes from public.ventas;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    perform public.registrar_venta(
      caja_cajero,
      jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1, 'descuento_pct', 15)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2125)));
    raise exception 'FAIL: el cajero pudo descontar 15 %% por ítem con tope 10';
  exception when sqlstate 'PV011' then
    ok := array_append(ok, 'el cajero no puede pasar el tope por ítem (PV011)');
  end;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    perform public.registrar_venta(
      caja_cajero,
      jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2225)),
      11);
    raise exception 'FAIL: el cajero pudo descontar 11 %% sobre el total con tope 10';
  exception when sqlstate 'PV011' then
    ok := array_append(ok, 'el cajero no puede pasar el tope sobre el total (PV011)');
  end;
  execute 'reset role';
  if (select count(*) from public.ventas) <> ventas_antes then
    raise exception 'FAIL: una venta rechazada dejó rastro';
  end if;
  ok := array_append(ok, 'una venta con descuento rechazado no deja rastro');

  -- El dueño sube el tope a 20 %: ahora el 15 % del cajero pasa.
  update public.configuracion set valor = '20'::jsonb
   where comercio_id = comercio and clave = 'descuento_max_cajero_pct';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  resultado := public.registrar_venta(
    caja_cajero,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1, 'descuento_pct', 15)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2125)));
  execute 'reset role';
  if (resultado ->> 'total')::numeric <> 2125 then
    raise exception 'FAIL: con tope 20 el 15 %% del cajero dio %', resultado;
  end if;
  ok := array_append(ok, 'el tope sale de configuracion: con 20 % el cajero descuenta 15 %');

  -- -------------------------------------------------------------------------------------------
  -- (c) Dueño sin tope, pagos que no coinciden y compatibilidad
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resultado := public.registrar_venta(
    caja_dueno,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1, 'descuento_pct', 50)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1250)));
  execute 'reset role';
  if (resultado ->> 'total')::numeric <> 1250 then
    raise exception 'FAIL: el 50 %% del dueño dio %', resultado;
  end if;
  ok := array_append(ok, 'el dueño descuenta 50 % sin tope');

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.registrar_venta(
      caja_dueno,
      jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1, 'descuento_pct', 100)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1)));
    raise exception 'FAIL: se aceptó una venta con total $ 0';
  exception when sqlstate 'PV004' then
    ok := array_append(ok, 'una venta no puede quedar en $ 0 por descuentos');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    -- El cliente cobra el bruto ($ 2.500) pero el total con 10 % es $ 2.250.
    perform public.registrar_venta(
      caja_dueno,
      jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1, 'descuento_pct', 10)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2500)));
    raise exception 'FAIL: se aceptaron pagos que no coinciden con el total con descuento';
  exception when sqlstate 'PV003' then
    ok := array_append(ok, 'los pagos tienen que coincidir con el total ya descontado');
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  -- La firma de 3 parámetros de la 0007 sigue funcionando (sin descuentos).
  resultado := public.registrar_venta(
    caja_dueno,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2500)));
  execute 'reset role';
  if (resultado ->> 'total')::numeric <> 2500 or (resultado ->> 'descuento')::numeric <> 0 then
    raise exception 'FAIL: la venta sin descuento dio %', resultado;
  end if;
  ok := array_append(ok, 'una venta sin descuentos sigue igual que antes');

  raise exception using
    errcode = 'PV999',
    message = format('VALIDACION OK (todo revertido): %s checks', array_length(ok, 1)),
    detail = array_to_string(ok, E'\n');
end
$$;
