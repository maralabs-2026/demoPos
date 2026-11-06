-- Validación del día comercial con hora de corte (0026).
-- Necesita las migraciones 0001-0026. Crea su propio comercio para que otras ventas no se mezclen.
--
--   supabase db query --linked -f supabase/tests/dia_comercial_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000026a1';
  c_tz constant text := 'America/Argentina/Cordoba';
  comercio uuid;
  producto uuid;
  efectivo uuid;
  caja uuid;
  madrugada uuid;
  manana uuid;
  borde uuid;
  reporte jsonb;
  resumen jsonb;
  corte interval;
  inicio_hoy timestamptz;
  ok text[] := '{}';
begin
  if to_regprocedure('public.corte_dia_comercial()') is null then
    raise exception 'FAIL: falta corte_dia_comercial (aplicar la migración 0026)';
  end if;

  insert into public.comercios (nombre) values ('Comercio día comercial (test)') returning id into comercio;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
          'dueno.dia@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre) values (dueno, comercio, 'dueno', 'Dueño (test)');
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Agua (test)', '2600000000001', 1000) returning id into producto;
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo')
  returning id into efectivo;
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, producto, 'ajuste', 10, 'Validación día comercial', dueno);
  insert into public.cajas (comercio_id, usuario_id, monto_inicial) values (comercio, dueno, 0)
  returning id into caja;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  madrugada := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000))) ->> 'venta_id')::uuid;
  manana := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 2)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2000))) ->> 'venta_id')::uuid;
  borde := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', producto, 'cantidad', 3)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 3000))) ->> 'venta_id')::uuid;
  execute 'reset role';

  -- Martes 10/02/2026: una venta a las 2:00, otra a las 10:00 y otra justo a las 6:00 (hora local).
  update public.ventas set created_at = '2026-02-10 02:00'::timestamp at time zone c_tz where id = madrugada;
  update public.ventas set created_at = '2026-02-10 10:00'::timestamp at time zone c_tz where id = manana;
  update public.ventas set created_at = '2026-02-10 06:00'::timestamp at time zone c_tz where id = borde;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);

  -- (a) Sin configurar, el día corta a las 00:00 como antes: las tres ventas son del martes.
  if public.corte_dia_comercial() <> interval '0' then
    raise exception 'FAIL (a): sin configurar el corte no es 0';
  end if;
  reporte := public.reporte_ventas('2026-02-09', '2026-02-10', 'dia');
  if jsonb_array_length(reporte -> 'periodos') <> 1
     or (reporte -> 'periodos' -> 0 ->> 'periodo') <> '2026-02-10'
     or (reporte -> 'periodos' -> 0 ->> 'total')::numeric <> 6000 then
    raise exception 'FAIL (a): sin corte, periodos = %', reporte -> 'periodos';
  end if;
  ok := ok || 'a: sin corte, día calendario'::text;

  -- (b) Con corte a las 6, la venta de las 2:00 es del lunes; las de las 6:00 y 10:00, del martes.
  execute 'reset role';
  insert into public.configuracion (comercio_id, clave, valor) values (comercio, 'dia_comercial_corte', '6');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);

  reporte := public.reporte_ventas('2026-02-09', '2026-02-10', 'dia');
  if jsonb_array_length(reporte -> 'periodos') <> 2
     or (reporte -> 'periodos' -> 0 ->> 'periodo') <> '2026-02-09'
     or (reporte -> 'periodos' -> 0 ->> 'total')::numeric <> 1000
     or (reporte -> 'periodos' -> 1 ->> 'periodo') <> '2026-02-10'
     or (reporte -> 'periodos' -> 1 ->> 'total')::numeric <> 5000 then
    raise exception 'FAIL (b): con corte, periodos = %', reporte -> 'periodos';
  end if;
  ok := ok || 'b: con corte a las 6, la madrugada es del día anterior'::text;

  -- (c) El rango también se corre: el martes solo, sin el lunes, no incluye la venta de las 2:00.
  reporte := public.reporte_ventas('2026-02-10', '2026-02-10', 'dia');
  if (reporte -> 'resumen' ->> 'ventas')::int <> 2
     or (reporte -> 'resumen' ->> 'total')::numeric <> 5000 then
    raise exception 'FAIL (c): resumen del martes = %', reporte -> 'resumen';
  end if;
  reporte := public.reporte_ventas('2026-02-11', '2026-02-11', 'dia');
  if (reporte -> 'resumen' ->> 'ventas')::int <> 0 then
    raise exception 'FAIL (c): el miércoles tomó ventas del martes';
  end if;
  ok := ok || 'c: el rango va de 6 a 6'::text;

  -- (d) "Hoy" en el inicio empieza en la hora de corte: una venta un minuto antes ya no cuenta.
  corte := public.corte_dia_comercial();
  inicio_hoy := ((((now() at time zone c_tz) - corte)::date)::timestamp + corte) at time zone c_tz;
  execute 'reset role';
  update public.ventas set created_at = inicio_hoy where id = manana;
  update public.ventas set created_at = inicio_hoy - interval '1 minute' where id = borde;
  update public.ventas set created_at = inicio_hoy - interval '2 days' where id = madrugada;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resumen := public.inicio_resumen();
  if (resumen -> 'hoy' ->> 'ventas')::int <> 1 or (resumen -> 'hoy' ->> 'total')::numeric <> 2000 then
    raise exception 'FAIL (d): hoy = %', resumen -> 'hoy';
  end if;
  ok := ok || 'd: hoy arranca en la hora de corte'::text;

  -- (e) Un valor fuera de rango o que no es un entero se ignora: el corte vuelve a 0.
  execute 'reset role';
  update public.configuracion set valor = '13' where comercio_id = comercio and clave = 'dia_comercial_corte';
  execute 'set local role authenticated';
  if public.corte_dia_comercial() <> interval '0' then
    raise exception 'FAIL (e): un corte de 13 no se ignoró';
  end if;
  execute 'reset role';
  update public.configuracion set valor = '5.5' where comercio_id = comercio and clave = 'dia_comercial_corte';
  execute 'set local role authenticated';
  if public.corte_dia_comercial() <> interval '0' then
    raise exception 'FAIL (e): un corte de 5,5 no se ignoró';
  end if;
  execute 'reset role';
  update public.configuracion set valor = '"6"' where comercio_id = comercio and clave = 'dia_comercial_corte';
  execute 'set local role authenticated';
  if public.corte_dia_comercial() <> interval '0' then
    raise exception 'FAIL (e): un corte de texto no se ignoró';
  end if;
  ok := ok || 'e: valores inválidos se ignoran'::text;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
