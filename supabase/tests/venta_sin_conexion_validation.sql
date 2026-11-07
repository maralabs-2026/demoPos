-- Validación de las ventas sin conexión (0028).
-- Necesita las migraciones 0001-0028. Crea su propio comercio para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/venta_sin_conexion_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000028a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000028a2';
  venta1 constant uuid := '00000000-0000-4000-8000-0000000028b1';
  venta2 constant uuid := '00000000-0000-4000-8000-0000000028b2';
  venta3 constant uuid := '00000000-0000-4000-8000-0000000028b3';
  comercio uuid;
  agua uuid;
  taza uuid;
  efectivo uuid;
  debito uuid;
  caja uuid;
  caja_dueno uuid;
  r jsonb;
  n integer;
  v public.ventas;
  ok text[] := '{}';
begin
  if to_regprocedure('public.registrar_venta_sin_conexion(uuid, uuid, timestamptz, jsonb, jsonb, numeric)') is null then
    raise exception 'FAIL: falta registrar_venta_sin_conexion (aplicar la migración 0028)';
  end if;

  insert into public.comercios (nombre) values ('Comercio sin conexión (test)') returning id into comercio;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
          'dueno.offline@test.invalid', '{}', '{}', now(), now()),
         ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
          'cajero.offline@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'), (cajero, comercio, 'cajero', 'Cajero (test)');
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Agua (test)', '2800000000001', 1000) returning id into agua;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Taza (test)', '2800000000002', 500) returning id into taza;
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ajuste', 1, 'Validación', dueno),
         (comercio, taza, 'ajuste', 10, 'Validación', dueno);
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo')
  returning id into efectivo;
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Débito', 'tarjeta')
  returning id into debito;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial, abierta_at)
  values (comercio, cajero, 0, now() - interval '2 hours') returning id into caja;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, dueno, 0) returning id into caja_dueno;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);

  -- (a) Dos aguas a $ 900 (el precio que tenía el dispositivo) con stock 1: entra igual, el stock
  -- queda en -1, con la hora de la venta y los dos avisos.
  r := public.registrar_venta_sin_conexion(venta1, caja, now() - interval '30 minutes',
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 2, 'precio_unitario', 900)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1800, 'recibido', 2000)));
  if (r ->> 'total')::numeric <> 1800 or (r ->> 'vuelto')::numeric <> 200 or (r ->> 'repetida')::boolean then
    raise exception 'FAIL (a): resultado = %', r;
  end if;
  execute 'reset role';
  select * into v from public.ventas where id = venta1;
  if not v.sin_conexion or v.sincronizada_at is null
     or v.created_at > now() - interval '29 minutes'
     or v.avisos_sin_conexion <> array['precio', 'stock']::text[] then
    raise exception 'FAIL (a): venta = %', row_to_json(v);
  end if;
  if (select stock_actual from public.productos where id = agua) <> -1 then
    raise exception 'FAIL (a): el stock del agua no quedó en -1';
  end if;
  if (select precio_unitario from public.venta_items where venta_id = venta1) <> 900 then
    raise exception 'FAIL (a): no guardó el precio cobrado';
  end if;
  ok := ok || 'a: entra sin stock, con el precio y la hora del cobro'::text;

  -- (b) Reenviarla devuelve la misma venta, sin duplicar ventas ni movimientos.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  r := public.registrar_venta_sin_conexion(venta1, caja, now() - interval '30 minutes',
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 2, 'precio_unitario', 900)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1800, 'recibido', 2000)));
  execute 'reset role';
  select count(*) into n from public.movimientos_stock where venta_id = venta1;
  if not (r ->> 'repetida')::boolean or n <> 1
     or (select count(*) from public.ventas where id = venta1) <> 1 then
    raise exception 'FAIL (b): repetida = %, movimientos = %', r ->> 'repetida', n;
  end if;
  ok := ok || 'b: reenviar no duplica'::text;

  -- (c) Fuera de una venta sin conexión el stock no baja de cero; subirlo siempre se puede.
  begin
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
    values (comercio, taza, 'ajuste', -11, 'Validación', dueno);
    raise exception 'FAIL (c): un ajuste dejó el stock negativo';
  exception when check_violation then
    null;
  end;
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ingreso', 1, null, dueno);
  if (select stock_actual from public.productos where id = agua) <> 0 then
    raise exception 'FAIL (c): el ingreso no subió el stock negativo';
  end if;
  ok := ok || 'c: solo la venta sin conexión baja de cero'::text;

  -- (d) La venta online sigue exigiendo stock.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)));
    raise exception 'FAIL (d): la venta online vendió sin stock';
  exception when sqlstate 'PV001' then
    ok := ok || 'd: la venta online sigue exigiendo stock'::text;
  end;

  -- (e) La hora tiene que caer dentro del turno de la caja.
  begin
    perform public.registrar_venta_sin_conexion(venta2, caja, now() - interval '3 hours',
      jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 1, 'precio_unitario', 500)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 500)));
    raise exception 'FAIL (e): aceptó una hora anterior a la apertura';
  exception when sqlstate 'PV024' then
    null;
  end;
  begin
    perform public.registrar_venta_sin_conexion(venta2, caja, now() + interval '1 hour',
      jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 1, 'precio_unitario', 500)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 500)));
    raise exception 'FAIL (e): aceptó una hora futura';
  exception when sqlstate 'PV024' then
    ok := ok || 'e: hora dentro del turno'::text;
  end;

  -- (f) El cajero no supera su tope de descuento (10 %): 20 % manual en una línea.
  begin
    perform public.registrar_venta_sin_conexion(venta2, caja, now(),
      jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 2, 'precio_unitario', 500,
                                           'descuento', 200)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 800)));
    raise exception 'FAIL (f): aceptó un descuento del 20 %%';
  exception when sqlstate 'PV011' then
    ok := ok || 'f: tope de descuento del cajero'::text;
  end;

  -- (g) Una promo no cuenta para el tope, y vale un medio que se desactivó después de cobrar.
  execute 'reset role';
  update public.medios_pago set activo = false where id = debito;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  r := public.registrar_venta_sin_conexion(venta2, caja, now(),
    jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 2, 'precio_unitario', 500,
                                         'descuento', 500, 'promocion_descuento', 500,
                                         'promocion_nombre', '2x1 Taza')),
    jsonb_build_array(jsonb_build_object('medio_pago_id', debito, 'monto', 500)));
  if (r ->> 'total')::numeric <> 500 or jsonb_array_length(r -> 'avisos') <> 0 then
    raise exception 'FAIL (g): resultado = %', r;
  end if;
  execute 'reset role';
  if (select promocion_nombre from public.venta_items where venta_id = venta2) <> '2x1 Taza' then
    raise exception 'FAIL (g): no guardó la promo';
  end if;
  ok := ok || 'g: promo guardada y medio desactivado aceptado'::text;

  -- (h) La caja tiene que ser de quien vende y estar abierta.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_venta_sin_conexion(venta3, caja_dueno, now(),
      jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 1, 'precio_unitario', 500)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 500)));
    raise exception 'FAIL (h): vendió en la caja de otro';
  exception when sqlstate 'PV002' then
    ok := ok || 'h: solo en la caja propia'::text;
  end;

  -- (i) Los pagos tienen que sumar el total, y un producto no puede venir dos veces.
  begin
    perform public.registrar_venta_sin_conexion(venta3, caja, now(),
      jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 1, 'precio_unitario', 500)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 400)));
    raise exception 'FAIL (i): aceptó pagos que no suman';
  exception when sqlstate 'PV003' then
    null;
  end;
  begin
    perform public.registrar_venta_sin_conexion(venta3, caja, now(),
      jsonb_build_array(
        jsonb_build_object('producto_id', taza, 'cantidad', 1, 'precio_unitario', 500),
        jsonb_build_object('producto_id', taza, 'cantidad', 1, 'precio_unitario', 500)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000)));
    raise exception 'FAIL (i): aceptó un producto repetido';
  exception when sqlstate 'PV004' then
    ok := ok || 'i: pagos y productos consistentes'::text;
  end;

  -- (j) Un reenvío después de cerrar la caja devuelve la venta que ya había entrado.
  execute 'reset role';
  update public.cajas set estado = 'cerrada', cerrada_at = now() where id = caja;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  r := public.registrar_venta_sin_conexion(venta1, caja, now() - interval '30 minutes',
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 2, 'precio_unitario', 900)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1800, 'recibido', 2000)));
  if not (r ->> 'repetida')::boolean then
    raise exception 'FAIL (j): resultado = %', r;
  end if;
  ok := ok || 'j: reenvío con la caja ya cerrada'::text;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
