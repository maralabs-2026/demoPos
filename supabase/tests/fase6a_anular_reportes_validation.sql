-- Validación de anulación de ventas y reporte (0021).
-- Necesita las migraciones 0001-0021 y el seed base (comercio "Kiosko Demo" y sus productos).
--
--   supabase db query --linked -f supabase/tests/fase6a_anular_reportes_validation.sql
--
-- Un único bloque DO: crea sus usuarios y datos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000021a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000021a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000021a3';
  dueno_otro constant uuid := '00000000-0000-4000-8000-0000000021a5';
  hoy constant date := (now() at time zone 'America/Argentina/Cordoba')::date;
  comercio uuid;
  otro_comercio uuid;
  coca uuid;
  otro_producto uuid;
  precio numeric;
  precio_otro numeric;
  efectivo uuid;
  tarjeta uuid;
  caja uuid;
  caja_encargado uuid;
  venta uuid;
  venta_tarjeta uuid;
  venta_mixta uuid;
  stock_antes integer;
  conteos jsonb;
  reporte jsonb;
  valor numeric;
  previsto numeric;
  filas integer;
  ok text[] := '{}';
begin
  if to_regprocedure('public.anular_venta(uuid, text)') is null then
    raise exception 'FAIL: falta anular_venta (aplicar la migración 0021)';
  end if;

  -- Fixtures (como postgres).
  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id, productos.precio into coca, precio from public.productos
   where comercio_id = comercio and codigo_barras = '7790010000154';
  select id, productos.precio into otro_producto, precio_otro from public.productos
   where comercio_id = comercio and id <> coca and productos.precio > 0
   and controla_stock order by id limit 1;
  select id into efectivo from public.medios_pago
   where comercio_id = comercio and tipo = 'efectivo' and activo order by orden limit 1;
  select id into tarjeta from public.medios_pago
   where comercio_id = comercio and tipo = 'tarjeta' and activo order by orden limit 1;
  if comercio is null or coca is null or otro_producto is null or efectivo is null or tarjeta is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  update public.promociones set activa = false where comercio_id = comercio;
  update public.combos set activa = false where comercio_id = comercio;
  delete from public.productos_costos where producto_id in (coca, otro_producto);
  insert into public.productos_costos (producto_id, comercio_id, costo) values (coca, comercio, 1000);

  insert into public.comercios (nombre) values ('Otro comercio (test anular)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.anular@test.invalid'),
                 (encargado, 'encargado.anular@test.invalid'),
                 (cajero, 'cajero.anular@test.invalid'),
                 (dueno_otro, 'dueno.otro.anular@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (dueno_otro, otro_comercio, 'dueno', 'Dueño de otro comercio (test)');

  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, coca, 'ajuste', 50, 'Validación anular', dueno),
         (comercio, otro_producto, 'ajuste', 50, 'Validación anular', dueno);

  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 1000) returning id into caja;

  -- (a) Con la caja abierta: vuelve el stock, sin movimiento de caja, y deja de sumar en el esperado.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  select stock_actual into stock_antes from public.productos where id = coca;
  venta := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 3)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', precio * 3))
  ) ->> 'venta_id')::uuid;

  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  perform public.anular_venta(venta, '  Se cobró de más  ');
  execute 'reset role';

  if not exists (
    select 1 from public.ventas
     where id = venta and estado = 'anulada' and anulada_por = encargado
       and anulada_at is not null and motivo_anulacion = 'Se cobró de más'
  ) then
    raise exception 'FAIL (a): la venta no quedó anulada con quién y por qué';
  end if;
  if (select stock_actual from public.productos where id = coca) <> stock_antes then
    raise exception 'FAIL (a): el stock no volvió';
  end if;
  if not exists (
    select 1 from public.movimientos_stock
     where venta_id = venta and tipo = 'anulacion' and cantidad = 3 and usuario_id = encargado
  ) then
    raise exception 'FAIL (a): falta el movimiento de stock inverso';
  end if;
  if exists (select 1 from public.caja_movimientos where venta_id = venta) then
    raise exception 'FAIL (a): se registró un movimiento de caja que descontaría dos veces';
  end if;
  ok := ok || 'a: con la caja abierta devuelve stock y no duplica el egreso'::text;

  -- (b) No se anula dos veces.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  begin
    perform public.anular_venta(venta, 'Otra vez');
    raise exception 'FAIL (b): se anuló dos veces';
  exception when sqlstate 'PV019' then
    null;
  end;
  execute 'reset role';
  select count(*) into filas from public.movimientos_stock where venta_id = venta and tipo = 'anulacion';
  if filas <> 1 then
    raise exception 'FAIL (b): hay % movimientos inversos', filas;
  end if;
  ok := ok || 'b: una venta no se anula dos veces'::text;

  -- (c) Permisos: el cajero no anula ni ve reportes; nadie escribe directo; otro comercio no opera.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  venta_tarjeta := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', tarjeta, 'monto', precio))
  ) ->> 'venta_id')::uuid;
  begin
    perform public.anular_venta(venta_tarjeta, 'Motivo');
    raise exception 'FAIL (c): el cajero anuló una venta';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.reporte_ventas(hoy, hoy);
    raise exception 'FAIL (c): el cajero vio el reporte';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.ventas set estado = 'anulada' where id = venta_tarjeta;
    raise exception 'FAIL (c): update directo';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_otro, 'role', 'authenticated')::text, true);
  begin
    perform public.anular_venta(venta_tarjeta, 'Motivo');
    raise exception 'FAIL (c): otro comercio anuló una venta';
  exception when sqlstate 'PV020' then
    null;
  end;
  if (public.reporte_ventas(hoy, hoy) -> 'resumen' ->> 'ventas')::int <> 0 then
    raise exception 'FAIL (c): otro comercio ve ventas en el reporte';
  end if;
  execute 'reset role';
  ok := ok || 'c: cajero y otro comercio no anulan ni ven; nadie escribe directo'::text;

  -- (d) Datos inválidos: sin rastro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    perform public.anular_venta(venta_tarjeta, '   ');
    raise exception 'FAIL (d): anuló sin motivo';
  exception when sqlstate 'PV020' then
    null;
  end;
  begin
    perform public.anular_venta(gen_random_uuid(), 'Motivo');
    raise exception 'FAIL (d): anuló una venta inexistente';
  exception when sqlstate 'PV020' then
    null;
  end;
  begin
    perform public.reporte_ventas(hoy, hoy - 1);
    raise exception 'FAIL (d): aceptó un período invertido';
  exception when sqlstate 'PV020' then
    null;
  end;
  begin
    perform public.reporte_ventas(hoy, hoy, 'anio');
    raise exception 'FAIL (d): aceptó una agrupación desconocida';
  exception when sqlstate 'PV020' then
    null;
  end;
  execute 'reset role';
  if (select estado from public.ventas where id = venta_tarjeta) <> 'completada' then
    raise exception 'FAIL (d): un pedido inválido anuló la venta';
  end if;
  ok := ok || 'd: datos inválidos no dejan rastro'::text;

  -- (e) Reporte: venta con descuento, producto sin costo y una anulada que no cuenta.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', round(precio * 2 * 0.9, 2))),
    10);
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', otro_producto, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', precio_otro)));

  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  reporte := public.reporte_ventas(hoy, hoy, 'dia', cajero);
  execute 'reset role';

  -- Completadas: 1 coca con tarjeta, 2 cocas con 10 %, 1 otro producto. La de 3 cocas está anulada.
  if (reporte -> 'resumen' ->> 'ventas')::int <> 3
     or (reporte -> 'resumen' ->> 'anuladas')::int <> 1
     or (reporte -> 'resumen' ->> 'total_anulado')::numeric <> precio * 3 then
    raise exception 'FAIL (e): cantidades del resumen: %', reporte -> 'resumen';
  end if;
  previsto := precio + round(precio * 2 * 0.9, 2) + precio_otro;
  if (reporte -> 'resumen' ->> 'total')::numeric <> previsto then
    raise exception 'FAIL (e): total % en vez de %', reporte -> 'resumen' ->> 'total', previsto;
  end if;
  previsto := (precio - 1000) + (round(precio * 2 * 0.9, 2) - 2000);
  if (reporte -> 'resumen' ->> 'ganancia')::numeric <> previsto then
    raise exception 'FAIL (e): ganancia % en vez de %', reporte -> 'resumen' ->> 'ganancia', previsto;
  end if;
  if (reporte -> 'resumen' ->> 'sin_costo')::numeric <> precio_otro then
    raise exception 'FAIL (e): sin costo %, debería ser %', reporte -> 'resumen' ->> 'sin_costo', precio_otro;
  end if;
  if (reporte -> 'ranking' -> 0 ->> 'producto_id')::uuid <> coca
     or (reporte -> 'ranking' -> 0 ->> 'cantidad')::int <> 3 then
    raise exception 'FAIL (e): ranking: %', reporte -> 'ranking';
  end if;
  if jsonb_array_length(reporte -> 'por_cajero') <> 1
     or (reporte -> 'por_cajero' -> 0 ->> 'usuario_id')::uuid <> cajero then
    raise exception 'FAIL (e): por cajero: %', reporte -> 'por_cajero';
  end if;
  if jsonb_array_length(reporte -> 'periodos') <> 1
     or (reporte -> 'periodos' -> 0 ->> 'periodo')::date <> hoy then
    raise exception 'FAIL (e): períodos: %', reporte -> 'periodos';
  end if;
  ok := ok || 'e: el reporte reparte descuentos, excluye anuladas y no inventa costos'::text;

  -- (f) El reporte del día coincide con el cierre de una caja abierta y cerrada el mismo día.
  select jsonb_agg(jsonb_build_object('medio_pago_id', m.id, 'contado', 0))
    into conteos
    from public.medios_pago m
   where m.comercio_id = comercio and m.activo;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.cerrar_caja(caja, conteos);
  execute 'reset role';

  select esperado into valor from public.caja_cierres where caja_id = caja and medio_pago_id = efectivo;
  select (e ->> 'total')::numeric into previsto
    from jsonb_array_elements(reporte -> 'por_medio') e
   where e ->> 'nombre' = (select nombre from public.medios_pago where id = efectivo);
  if valor is distinct from previsto + 1000 then
    raise exception 'FAIL (f): cierre % contra reporte % + fondo 1000', valor, previsto;
  end if;
  select esperado into valor from public.caja_cierres where caja_id = caja and medio_pago_id = tarjeta;
  select (e ->> 'total')::numeric into previsto
    from jsonb_array_elements(reporte -> 'por_medio') e
   where e ->> 'nombre' = (select nombre from public.medios_pago where id = tarjeta);
  if valor is distinct from previsto then
    raise exception 'FAIL (f): tarjeta: cierre % contra reporte %', valor, previsto;
  end if;
  ok := ok || 'f: el reporte diario coincide con el cierre'::text;

  -- (g) Caja cerrada, venta con tarjeta: se anula sin caja abierta y sin movimiento.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  perform public.anular_venta(venta_tarjeta, 'Error de carga');
  execute 'reset role';
  if exists (select 1 from public.caja_movimientos where venta_id = venta_tarjeta) then
    raise exception 'FAIL (g): la tarjeta generó un movimiento de caja';
  end if;
  ok := ok || 'g: anular una venta con tarjeta de una caja cerrada no toca el efectivo'::text;

  -- (h) Caja cerrada con efectivo: sin caja abierta no se puede y no deja rastro. Con caja, retiro
  -- solo por el efectivo de un pago combinado, y el cierre pasado no cambia.
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 0) returning id into caja;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  venta_mixta := (public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', precio),
                      jsonb_build_object('medio_pago_id', tarjeta, 'monto', precio))
  ) ->> 'venta_id')::uuid;
  perform public.cerrar_caja(caja, conteos);

  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  select stock_actual into stock_antes from public.productos where id = coca;
  begin
    perform public.anular_venta(venta_mixta, 'Devolución');
    raise exception 'FAIL (h): anuló sin caja para devolver el efectivo';
  exception when sqlstate 'PV018' then
    null;
  end;
  execute 'reset role';
  if (select estado from public.ventas where id = venta_mixta) <> 'completada'
     or (select stock_actual from public.productos where id = coca) <> stock_antes then
    raise exception 'FAIL (h): el intento rechazado dejó rastro';
  end if;

  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, encargado, 5000) returning id into caja_encargado;
  select esperado into valor from public.caja_cierres where caja_id = caja and medio_pago_id = efectivo;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  perform public.anular_venta(venta_mixta, 'Devolución');
  execute 'reset role';

  if not exists (
    select 1 from public.caja_movimientos
     where caja_id = caja_encargado and venta_id = venta_mixta and tipo = 'retiro'
       and monto = precio and motivo = 'Venta anulada: Devolución' and usuario_id = encargado
  ) then
    raise exception 'FAIL (h): falta el retiro solo por el efectivo';
  end if;
  if (select esperado from public.caja_cierres where caja_id = caja and medio_pago_id = efectivo)
     is distinct from valor then
    raise exception 'FAIL (h): cambió un cierre pasado';
  end if;
  if (select stock_actual from public.productos where id = coca) <> stock_antes + 2 then
    raise exception 'FAIL (h): el stock no volvió';
  end if;
  ok := ok || 'h: con la caja cerrada, el efectivo sale de la caja de quien anula'::text;

  -- (i) Los textos del ticket están en configuración.
  if not exists (
    select 1 from public.configuracion cfg
     where comercio_id = comercio and clave = 'ticket'
       and cfg.valor ? 'titulo' and cfg.valor ? 'leyenda' and cfg.valor ? 'pie'
  ) then
    raise exception 'FAIL (i): faltan los textos del ticket';
  end if;
  ok := ok || 'i: los textos del ticket viven en configuración'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
