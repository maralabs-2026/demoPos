-- Validación de la verificación de transferencias (0044).
-- Necesita las migraciones 0001-0044. Crea sus propios comercios para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/verificacion_transferencias_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000044a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000044a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000044a3';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000044a4';
  comercio uuid;
  otro uuid;
  agua uuid;
  efectivo uuid;
  transferencia uuid;
  caja uuid;
  venta_t uuid;
  venta_anulada uuid;
  pago_t uuid;
  pago_e uuid;
  pago_anulado uuid;
  r jsonb;
  n integer;
  ok text[] := '{}';
begin
  if to_regprocedure('public.verificar_pago(uuid,text)') is null then
    raise exception 'FAIL: falta verificar_pago (aplicar la migración 0044)';
  end if;

  insert into public.comercios (nombre) values ('Comercio transferencias (test)') returning id into comercio;
  insert into public.comercios (nombre) values ('Otro comercio transferencias (test)') returning id into otro;
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
  values (comercio, 'Agua (test)', '3000000000044', 1000) returning id into agua;
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ajuste', 10, 'Validación', dueno);
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo')
  returning id into efectivo;
  insert into public.medios_pago (comercio_id, nombre, tipo)
  values (comercio, 'Transferencia', 'transferencia') returning id into transferencia;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial, abierta_at)
  values (comercio, cajero, 0, now() - interval '1 hour') returning id into caja;

  -- Tres ventas del cajero: una por transferencia, una en efectivo y una por transferencia que
  -- después se anula.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  venta_t := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', transferencia, 'monto', 1000))) ->> 'venta_id')::uuid;
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)));
  venta_anulada := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', transferencia, 'monto', 1000))) ->> 'venta_id')::uuid;

  execute 'reset role';
  select p.id into pago_t from public.venta_pagos p where p.venta_id = venta_t;
  select p.id into pago_e from public.venta_pagos p
    join public.ventas v on v.id = p.venta_id
   where v.caja_id = caja and p.medio_pago_id = efectivo;
  select p.id into pago_anulado from public.venta_pagos p where p.venta_id = venta_anulada;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  perform public.anular_venta(venta_anulada, 'Validación');

  -- (a) El cajero no verifica ni ve las verificaciones.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.verificar_pago(pago_t, 'llego');
    raise exception 'FAIL (a): el cajero verificó';
  exception when insufficient_privilege then
    ok := ok || 'a: el cajero no verifica'::text;
  end;

  -- (b) Otro comercio no encuentra el pago.
  perform set_config('request.jwt.claims',
    json_build_object('sub', otro_dueno, 'role', 'authenticated')::text, true);
  begin
    perform public.verificar_pago(pago_t, 'llego');
    raise exception 'FAIL (b): otro comercio verificó';
  exception when sqlstate 'PV034' then
    ok := ok || 'b: otro comercio no lo ve'::text;
  end;

  -- (c) Un pago en efectivo y uno de una venta anulada no se verifican; un estado inventado, tampoco.
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  begin
    perform public.verificar_pago(pago_e, 'llego');
    raise exception 'FAIL (c): verificó un pago en efectivo';
  exception when sqlstate 'PV034' then
    null;
  end;
  begin
    perform public.verificar_pago(pago_anulado, 'llego');
    raise exception 'FAIL (c): verificó un pago de una venta anulada';
  exception when sqlstate 'PV034' then
    null;
  end;
  begin
    perform public.verificar_pago(pago_t, 'quizas');
    raise exception 'FAIL (c): aceptó un estado inválido';
  exception when sqlstate 'PV035' then
    null;
  end;
  ok := ok || 'c: solo transferencias de ventas completadas, con estado válido'::text;

  -- (d) El encargado marca "no llegó" y el dueño, después, "llegó": quedan las dos marcas y la
  -- última es la vigente. La venta, el stock y la caja no cambian.
  r := public.verificar_pago(pago_t, 'no_llego');
  if r ->> 'estado' <> 'no_llego' then
    raise exception 'FAIL (d): resultado = %', r;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.verificar_pago(pago_t, 'llego');
  select count(*) into n from public.pago_verificaciones where venta_pago_id = pago_t;
  if n <> 2 or (select estado from public.pago_verificaciones where venta_pago_id = pago_t
                 order by created_at desc, id desc limit 1) is null then
    raise exception 'FAIL (d): hay % marcas', n;
  end if;
  execute 'reset role';
  if (select usuario_id from public.pago_verificaciones
       where venta_pago_id = pago_t and estado = 'llego') <> dueno
     or (select usuario_id from public.pago_verificaciones
          where venta_pago_id = pago_t and estado = 'no_llego') <> encargado
     or (select estado from public.ventas where id = venta_t) <> 'completada'
     or (select total from public.ventas where id = venta_t) <> 1000
     or (select stock_actual from public.productos where id = agua) <> 8 then
    raise exception 'FAIL (d): la verificación cambió la venta o el stock, o no guardó quién';
  end if;
  ok := ok || 'd: historial de marcas sin tocar la venta'::text;

  -- (e) El cajero no lee la tabla; el dueño de otro comercio tampoco.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  select count(*) into n from public.pago_verificaciones;
  if n <> 0 then
    raise exception 'FAIL (e): el cajero ve % marcas', n;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', otro_dueno, 'role', 'authenticated')::text, true);
  select count(*) into n from public.pago_verificaciones where venta_pago_id = pago_t;
  if n <> 0 then
    raise exception 'FAIL (e): otro comercio ve % marcas', n;
  end if;
  ok := ok || 'e: solo dueño y encargado del comercio leen'::text;

  -- (f) Nadie escribe ni borra marcas a mano.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    insert into public.pago_verificaciones (comercio_id, venta_pago_id, estado, usuario_id)
    values (comercio, pago_t, 'llego', dueno);
    raise exception 'FAIL (f): se pudo insertar a mano';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.pago_verificaciones where venta_pago_id = pago_t;
    if found then
      raise exception 'FAIL (f): se pudo borrar a mano';
    end if;
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'f: sin escritura directa'::text;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
