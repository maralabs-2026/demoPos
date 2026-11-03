-- Validación del snapshot de costos de la venta (0017).
-- Necesita las migraciones 0001-0017 y el seed base (comercio "Kiosko Demo" y sus productos).
--
--   supabase db query --linked -f supabase/tests/costos_snapshot_validation.sql
--
-- Un único bloque DO: crea sus usuarios y datos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000017a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000017a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000017a3';
  dueno_otro constant uuid := '00000000-0000-4000-8000-0000000017a4';
  comercio uuid;
  otro_comercio uuid;
  con_costo uuid;
  sin_costo uuid;
  precio_con numeric;
  precio_sin numeric;
  efectivo uuid;
  caja uuid;
  resultado jsonb;
  venta uuid;
  item_con uuid;
  item_sin uuid;
  filas integer;
  valor numeric;
  ok text[] := '{}';
begin
  if to_regclass('public.venta_items_costos') is null then
    raise exception 'FAIL: falta venta_items_costos (aplicar la migración 0017)';
  end if;

  -- Fixtures (como postgres).
  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id, precio into con_costo, precio_con from public.productos
   where comercio_id = comercio and codigo_barras = '7790010000154';
  select id, precio into sin_costo, precio_sin from public.productos
   where comercio_id = comercio and codigo_barras = '7790010000017';
  select id into efectivo from public.medios_pago
   where comercio_id = comercio and tipo = 'efectivo' and activo limit 1;
  if comercio is null or con_costo is null or sin_costo is null or efectivo is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  -- Sin promos ni combos activos: el total de la venta es el de lista.
  update public.promociones set activa = false where comercio_id = comercio;
  update public.combos set activa = false where comercio_id = comercio;

  insert into public.comercios (nombre) values ('Otro comercio (test costos)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.costos@test.invalid'),
                 (encargado, 'encargado.costos@test.invalid'),
                 (cajero, 'cajero.costos@test.invalid'),
                 (dueno_otro, 'otro.costos@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (dueno_otro, otro_comercio, 'dueno', 'Dueño de otro comercio (test)');

  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 0) returning id into caja;

  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, con_costo, 'ajuste', 10, 'Validación costos', dueno),
         (comercio, sin_costo, 'ajuste', 10, 'Validación costos', dueno);

  insert into public.productos_costos (producto_id, comercio_id, costo)
  values (con_costo, comercio, 500)
  on conflict (producto_id) do update set costo = excluded.costo;
  delete from public.productos_costos where producto_id = sin_costo;

  -- (a) El cajero vende: el costo queda guardado aunque él no pueda leerlo.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);

  resultado := public.registrar_venta(
    caja,
    jsonb_build_array(
      jsonb_build_object('producto_id', con_costo, 'cantidad', 2),
      jsonb_build_object('producto_id', sin_costo, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object(
      'medio_pago_id', efectivo, 'monto', precio_con * 2 + precio_sin)));
  venta := (resultado ->> 'venta_id')::uuid;

  if resultado::text like '%costo%' then
    raise exception 'FAIL (a): registrar_venta le devuelve el costo al cajero: %', resultado;
  end if;
  ok := ok || 'a: el cajero vende y no recibe el costo'::text;

  -- (b) El cajero no ve ni toca los costos.
  select count(*) into filas from public.venta_items_costos;
  if filas <> 0 then
    raise exception 'FAIL (b): el cajero ve % costos', filas;
  end if;
  begin
    update public.venta_items_costos set costo = 1;
    raise exception 'FAIL (b): el cajero pudo intentar cambiar un costo';
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'b: el cajero no lee ni escribe'::text;

  execute 'reset role';

  select id into item_con from public.venta_items where venta_id = venta and producto_id = con_costo;
  select id into item_sin from public.venta_items where venta_id = venta and producto_id = sin_costo;

  -- (c) El snapshot guarda el costo por unidad y el comercio del ítem.
  select costo into valor from public.venta_items_costos
   where venta_item_id = item_con and comercio_id = comercio;
  if valor is distinct from 500::numeric then
    raise exception 'FAIL (c): se esperaba costo 500 y se guardó %', valor;
  end if;
  ok := ok || 'c: costo por unidad guardado'::text;

  -- (d) Un producto sin costo no frena la venta ni genera fila.
  if item_sin is null then
    raise exception 'FAIL (d): falta el ítem del producto sin costo';
  end if;
  if exists (select 1 from public.venta_items_costos where venta_item_id = item_sin) then
    raise exception 'FAIL (d): el producto sin costo generó una fila';
  end if;
  ok := ok || 'd: sin costo no hay fila y la venta pasa'::text;

  -- (e) Cambiar el costo después no altera la venta pasada.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);

  update public.productos_costos set costo = 999 where producto_id = con_costo;
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (e): el encargado no pudo cambiar el costo actual';
  end if;

  select costo into valor from public.venta_items_costos where venta_item_id = item_con;
  if valor is distinct from 500::numeric then
    raise exception 'FAIL (e): el snapshot pasó a %', valor;
  end if;
  ok := ok || 'e: cambiar el costo no altera la venta'::text;

  -- (f) El encargado lee el snapshot (caso e), pero no lo puede modificar.
  begin
    update public.venta_items_costos set costo = 1 where venta_item_id = item_con;
    raise exception 'FAIL (f): el encargado pudo intentar cambiar el snapshot';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.venta_items_costos where venta_item_id = item_con;
    raise exception 'FAIL (f): el encargado pudo intentar borrar el snapshot';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.venta_items_costos (venta_item_id, comercio_id, costo)
    values (item_sin, comercio, 1);
    raise exception 'FAIL (f): el encargado pudo intentar cargar un snapshot';
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'f: el encargado lee y no escribe'::text;

  -- (g) El dueño lee el snapshot de su comercio.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.venta_items_costos where venta_item_id = item_con) then
    raise exception 'FAIL (g): el dueño no ve el snapshot';
  end if;
  ok := ok || 'g: el dueño lee'::text;

  -- (h) El dueño de otro comercio no lo ve.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_otro, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.venta_items_costos where venta_item_id = item_con) then
    raise exception 'FAIL (h): otro comercio ve el snapshot';
  end if;
  ok := ok || 'h: otro comercio no lo ve'::text;

  execute 'reset role';

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
