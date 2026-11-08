-- Validación del vínculo entre cobro con QR y venta (0038).
-- Necesita las migraciones 0001-0038. Crea su propio comercio para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/mp_cobro_venta_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000038a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000038a2';
  comercio uuid;
  punto uuid;
  prod uuid;
  qr uuid;
  caja uuid;
  c1 uuid;
  v1 uuid;
  e text;
  r record;
  ok text[] := '{}';
begin
  insert into public.comercios (nombre) values ('Comercio QR (test)') returning id into comercio;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, cajero]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'), (cajero, comercio, 'cajero', 'Cajero (test)');
  insert into public.mp_puntos (comercio_id, nombre, external_pos_id)
  values (comercio, 'Caja', 'CAJA38') returning id into punto;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio, controla_stock)
  values (comercio, 'Servicio (test)', '3800000000001', 1000, false) returning id into prod;
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo');
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'QR', 'qr') returning id into qr;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial) values (comercio, cajero, 0) returning id into caja;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', cajero, 'role', 'authenticated')::text, true);

  -- (a) Una orden sin cobrar no cierra una venta.
  c1 := public.crear_mp_cobro(punto, 1000);
  perform public.fijar_orden_mp_cobro(c1, 'ORD-A');
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', prod, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', qr, 'monto', 1000, 'referencia_externa', 'ORD-A')));
    raise exception 'FAIL (a): cerró con orden pendiente';
  exception when sqlstate 'PV032' then
    ok := ok || 'a: orden pendiente rechazada'::text;
  end;

  -- (b) Aprobada: la venta se vincula sola y no queda para revisar.
  execute 'reset role';
  execute 'set local role service_role';
  e := public.aplicar_estado_mp_cobro(c1, 'ORD-A', 'aprobado', 1000);
  execute 'reset role';
  execute 'set local role authenticated';
  v1 := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', prod, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', qr, 'monto', 1000, 'referencia_externa', 'ORD-A'))) ->> 'venta_id')::uuid;
  select * into r from public.mp_cobros where id = c1;
  if r.venta_id is distinct from v1 then raise exception 'FAIL (b): no vinculó'; end if;
  if (select qr_manual from public.ventas where id = v1) then raise exception 'FAIL (b): marcó manual'; end if;
  ok := ok || 'b: aprobada vincula'::text;

  -- (c) La misma orden no se usa dos veces.
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', prod, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', qr, 'monto', 1000, 'referencia_externa', 'ORD-A')));
    raise exception 'FAIL (c): usó la orden dos veces';
  exception when sqlstate 'PV032' then
    ok := ok || 'c: orden no se repite'::text;
  end;

  -- (d) Confirmada a mano: venta marcada, el cajero no la revisa y el dueño sí.
  c1 := public.crear_mp_cobro(punto, 1000);
  begin
    perform public.confirmar_mp_cobro_manual(c1);
    raise exception 'FAIL (d): confirmó sin orden';
  exception when sqlstate 'PV031' then null;
  end;
  perform public.fijar_orden_mp_cobro(c1, 'ORD-D');
  e := public.confirmar_mp_cobro_manual(c1);
  if e <> 'ORD-D' then raise exception 'FAIL (d): devolvió %', e; end if;
  v1 := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', prod, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', qr, 'monto', 1000, 'referencia_externa', 'ORD-D'))) ->> 'venta_id')::uuid;
  if not (select qr_manual from public.ventas where id = v1) then raise exception 'FAIL (d): sin marca'; end if;
  begin
    perform public.marcar_venta_revisada(v1);
    raise exception 'FAIL (d): el cajero revisó';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.marcar_venta_revisada(v1);
  if (select revisada_at from public.ventas where id = v1) is null then raise exception 'FAIL (d): no revisó'; end if;
  ok := ok || 'd: manual marcada y revisada'::text;

  -- (e) El aviso real llega después y actualiza la confirmación a mano.
  execute 'reset role';
  execute 'set local role service_role';
  e := public.aplicar_estado_mp_cobro(c1, 'ORD-D', 'aprobado', 1000);
  if e <> 'aprobado' then raise exception 'FAIL (e): %', e; end if;
  ok := ok || 'e: aviso posterior actualiza'::text;
  execute 'reset role';

  -- (f) Una referencia que no es una orden sigue funcionando y el monto debe coincidir.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', prod, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', qr, 'monto', 1000, 'referencia_externa', 'OTRA')));
  c1 := public.crear_mp_cobro(punto, 900);
  perform public.fijar_orden_mp_cobro(c1, 'ORD-F');
  perform public.confirmar_mp_cobro_manual(c1);
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', prod, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', qr, 'monto', 1000, 'referencia_externa', 'ORD-F')));
    raise exception 'FAIL (f): aceptó otro monto';
  exception when sqlstate 'PV032' then
    ok := ok || 'f: referencia libre y monto exacto'::text;
  end;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
