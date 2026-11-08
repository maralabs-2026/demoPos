-- Validación del análisis de reportes (0036).
-- Necesita las migraciones 0001-0036. Crea sus propios comercios para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/reporte_analisis_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000036a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000036a2';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000036a3';
  c_tz constant text := 'America/Argentina/Cordoba';
  dia constant date := '2026-02-10'; -- martes
  comercio uuid;
  otro uuid;
  bebidas uuid;
  agua uuid;
  taza uuid;
  quieto uuid;
  carga uuid;
  efectivo uuid;
  caja uuid;
  v1 uuid;
  v2 uuid;
  v3 uuid;
  r jsonb;
  ok text[] := '{}';
begin
  if to_regprocedure('public.reporte_analisis(date, date)') is null then
    raise exception 'FAIL: falta reporte_analisis (aplicar la migración 0036)';
  end if;

  insert into public.comercios (nombre) values ('Comercio análisis (test)') returning id into comercio;
  insert into public.comercios (nombre) values ('Otro comercio análisis (test)') returning id into otro;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, cajero, otro_dueno]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'), (cajero, comercio, 'cajero', 'Cajero (test)'),
         (otro_dueno, otro, 'dueno', 'Otro dueño (test)');
  insert into public.categorias (comercio_id, nombre) values (comercio, 'Bebidas (test)') returning id into bebidas;
  insert into public.productos (comercio_id, categoria_id, nombre, codigo_barras, precio)
  values (comercio, bebidas, 'Agua (test)', '3600000000001', 1000) returning id into agua;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Taza (test)', '3600000000002', 2000) returning id into taza;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio)
  values (comercio, 'Quieto (test)', '3600000000003', 500) returning id into quieto;
  insert into public.productos (comercio_id, nombre, codigo_barras, precio, controla_stock)
  values (comercio, 'Carga (test)', '3600000000004', 100, false) returning id into carga;
  insert into public.productos_costos (producto_id, comercio_id, costo)
  values (agua, comercio, 600), (quieto, comercio, 300);
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ingreso', 20, null, dueno), (comercio, taza, 'ingreso', 20, null, dueno),
         (comercio, quieto, 'ingreso', 4, null, dueno);
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo') returning id into efectivo;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial) values (comercio, dueno, 0) returning id into caja;
  insert into public.configuracion (comercio_id, clave, valor) values (comercio, 'dia_comercial_corte', '6');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  v1 := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 2)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2000))) ->> 'venta_id')::uuid;
  v2 := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', taza, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2000))) ->> 'venta_id')::uuid;
  v3 := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 1000))) ->> 'venta_id')::uuid;
  perform public.anular_venta(v3, 'Validación análisis');
  execute 'reset role';

  -- Martes 22:00 y miércoles 02:00: con corte a las 6, las dos son del martes comercial.
  update public.ventas set created_at = (dia::timestamp + interval '22 hours') at time zone c_tz where id in (v1, v3);
  update public.ventas set created_at = ((dia + 1)::timestamp + interval '2 hours') at time zone c_tz where id = v2;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  r := public.reporte_analisis(dia, dia);

  -- (a) Margen por categoría, con lo vendido sin costo aparte y sin las anuladas.
  if jsonb_array_length(r -> 'categorias') <> 2
     or r -> 'categorias' -> 0 ->> 'categoria' <> 'Bebidas (test)'
     or (r -> 'categorias' -> 0 ->> 'total')::numeric <> 2000
     or (r -> 'categorias' -> 0 ->> 'ganancia')::numeric <> 800
     or (r -> 'categorias' -> 0 ->> 'sin_costo')::numeric <> 0
     or r -> 'categorias' -> 1 ->> 'categoria' <> 'Sin categoría'
     or (r -> 'categorias' -> 1 ->> 'ganancia')::numeric <> 0
     or (r -> 'categorias' -> 1 ->> 'sin_costo')::numeric <> 2000 then
    raise exception 'FAIL (a): %', r -> 'categorias';
  end if;
  ok := ok || 'a: margen por categoría, sin costo aparte y sin anuladas'::text;

  -- (b) La hora es la real; el día es el comercial: las dos ventas caen el martes (2).
  if jsonb_array_length(r -> 'por_hora') <> 2
     or (r -> 'por_hora' -> 0 ->> 'hora')::int <> 2
     or (r -> 'por_hora' -> 1 ->> 'hora')::int <> 22
     or jsonb_array_length(r -> 'por_dia') <> 1
     or (r -> 'por_dia' -> 0 ->> 'dia')::int <> 2
     or (r -> 'por_dia' -> 0 ->> 'ventas')::int <> 2
     or (r -> 'por_dia' -> 0 ->> 'total')::numeric <> 4000 then
    raise exception 'FAIL (b): % %', r -> 'por_hora', r -> 'por_dia';
  end if;
  ok := ok || 'b: hora real y día comercial'::text;

  -- (c) Sin movimiento: el que tiene stock y no se vendió, sin servicios, con lo inmovilizado.
  if (r ->> 'sin_movimiento_total')::int <> 1
     or r -> 'sin_movimiento' -> 0 ->> 'nombre' <> 'Quieto (test)'
     or (r -> 'sin_movimiento' -> 0 ->> 'inmovilizado')::numeric <> 1200
     or r -> 'sin_movimiento' -> 0 ->> 'ultima_venta' is not null then
    raise exception 'FAIL (c): %', r -> 'sin_movimiento';
  end if;
  ok := ok || 'c: sin movimiento, con lo inmovilizado'::text;

  -- (d) Otro período: nada vendido, los productos con stock quedan sin movimiento y con su última
  -- venta. La anulada no cuenta como venta.
  r := public.reporte_analisis(dia + 10, dia + 10);
  if jsonb_array_length(r -> 'categorias') <> 0 or (r ->> 'sin_movimiento_total')::int <> 3
     or (select e ->> 'ultima_venta' from jsonb_array_elements(r -> 'sin_movimiento') e
          where e ->> 'nombre' = 'Agua (test)') is null then
    raise exception 'FAIL (d): %', r;
  end if;
  ok := ok || 'd: período vacío con la última venta'::text;

  -- (e) El cajero no accede y otro comercio no ve nada.
  perform set_config('request.jwt.claims', json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.reporte_analisis(dia, dia);
    raise exception 'FAIL (e): el cajero vio el análisis';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', otro_dueno, 'role', 'authenticated')::text, true);
  r := public.reporte_analisis(dia, dia);
  if jsonb_array_length(r -> 'categorias') <> 0 or (r ->> 'sin_movimiento_total')::int <> 0 then
    raise exception 'FAIL (e): otro comercio vio datos: %', r;
  end if;
  ok := ok || 'e: por rol y por comercio'::text;

  -- (f) Un período inválido se rechaza.
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    perform public.reporte_analisis(dia, dia - 1);
    raise exception 'FAIL (f): aceptó un período invertido';
  exception when sqlstate 'PV020' then
    ok := ok || 'f: período inválido'::text;
  end;

  execute 'reset role';
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
