-- Validación de la Fase 3: ingreso de mercadería y ajuste manual con motivo.
-- Necesita las migraciones 0001-0007 y el seed base (comercio "Kiosko Demo" y sus productos).
-- Es SQL puro, así que corre igual por psql o por la API del CLI:
--
--   supabase db query --linked -f supabase/tests/fase3_stock_validation.sql
--   psql "<connection-string>" -X -f supabase/tests/fase3_stock_validation.sql
--
-- Es un único bloque DO: crea sus propios usuarios de prueba y, al terminar, SIEMPRE aborta con
-- una excepción. Así se revierte todo y no queda rastro (importa porque movimientos_stock es de
-- solo agregado). El resultado viene en el mensaje de error:
--   "VALIDACION OK (todo revertido): ..." si pasó todo, o "FAIL: ..." en la primera falla.
-- Los roles se simulan como PostgREST: SET ROLE + claims JWT en request.jwt.claims.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000003d1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000003e2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000003c3';
  comercio_b constant uuid := '00000000-0000-4000-8000-00000000000b';
  producto_b constant uuid := '00000000-0000-4000-8000-0000000000b1';
  comercio uuid;
  coca uuid;
  stock0 integer;
  stock1 integer;
  stock2 integer;
  movs0 integer;
  movs2 integer;
  n integer;
  ok text[] := '{}';
begin
  -- -------------------------------------------------------------------------------------------
  -- Fixtures (como postgres)
  -- -------------------------------------------------------------------------------------------
  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el comercio "Kiosko Demo" (correr el seed base)';
  end if;
  select id, stock_actual into coca, stock0
    from public.productos where codigo_barras = '7790010000154';
  if coca is null then
    raise exception 'FAIL: falta el producto 7790010000154 (correr el seed base)';
  end if;
  select count(*) into movs0 from public.movimientos_stock where producto_id = coca;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
     'dueno.fase3@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', encargado, 'authenticated', 'authenticated',
     'encargado.fase3@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
     'cajero.fase3@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)');

  insert into public.comercios (id, nombre) values (comercio_b, 'Comercio B (test)');
  insert into public.productos (id, comercio_id, nombre, codigo_barras, precio, stock_minimo)
  values (producto_b, comercio_b, 'Producto de otro comercio', '9990000000001', 100, 0);

  -- -------------------------------------------------------------------------------------------
  -- (a) Ingreso de mercadería: suma stock
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, coca, 'ingreso', 10, 'Remito 0001-123', dueno);
  execute 'reset role';

  select stock_actual into stock1 from public.productos where id = coca;
  if stock1 <> stock0 + 10 then
    raise exception 'FAIL: el ingreso de 10 no subió el stock (antes %, después %)', stock0, stock1;
  end if;
  ok := array_append(ok, format('ingreso +10 del dueño: stock %s -> %s', stock0, stock1));

  -- -------------------------------------------------------------------------------------------
  -- (b) Ajuste manual con motivo: resta stock
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, coca, 'ajuste', -3, 'Vencido', encargado);
  execute 'reset role';

  select stock_actual into stock2 from public.productos where id = coca;
  select count(*) into movs2 from public.movimientos_stock where producto_id = coca;
  if stock2 <> stock1 - 3 then
    raise exception 'FAIL: el ajuste de -3 no bajó el stock (antes %, después %)', stock1, stock2;
  end if;
  ok := array_append(ok, format('ajuste -3 del encargado: stock %s -> %s', stock1, stock2));
  if movs2 <> movs0 + 2 then
    raise exception 'FAIL: se esperaban 2 movimientos nuevos y hay %', movs2 - movs0;
  end if;
  ok := array_append(ok, 'quedan registrados los 2 movimientos');
  if (select sum(cantidad) from public.movimientos_stock where producto_id = coca) <> stock2 then
    raise exception 'FAIL: stock_actual no coincide con la suma de movimientos';
  end if;
  ok := array_append(ok, 'stock_actual coincide con la suma de movimientos');

  -- -------------------------------------------------------------------------------------------
  -- (c) Rechazos. Cada intento va en su propio bloque: al fallar se revierte solo ese intento
  -- (y su SET LOCAL ROLE), así que se vuelve a postgres automáticamente.
  -- -------------------------------------------------------------------------------------------
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, usuario_id)
    values (comercio, coca, 'ajuste', -1, dueno);
    raise exception 'FAIL: se aceptó un ajuste sin motivo';
  exception when check_violation then
    ok := array_append(ok, 'rechaza un ajuste sin motivo');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
    values (comercio, coca, 'ajuste', -(stock2 + 1), 'Conteo', dueno);
    raise exception 'FAIL: se aceptó dejar el stock negativo';
  exception when check_violation then
    ok := array_append(ok, 'rechaza un ajuste que deja el stock negativo');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, usuario_id)
    values (comercio, coca, 'ingreso', 1, encargado);
    raise exception 'FAIL: se aceptó un movimiento a nombre de otro usuario';
  exception when insufficient_privilege then
    ok := array_append(ok, 'rechaza un movimiento a nombre de otro usuario');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, usuario_id, venta_id)
    values (comercio, coca, 'venta', -1, dueno, gen_random_uuid());
    raise exception 'FAIL: se aceptó un movimiento de venta cargado a mano';
  exception when insufficient_privilege then
    ok := array_append(ok, 'rechaza un movimiento de tipo venta cargado a mano');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, usuario_id)
    values (comercio_b, producto_b, 'ingreso', 5, dueno);
    raise exception 'FAIL: se aceptó un ingreso en otro comercio';
  exception when insufficient_privilege then
    ok := array_append(ok, 'rechaza cargar stock en otro comercio');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    update public.movimientos_stock set cantidad = 100 where producto_id = coca;
    raise exception 'FAIL: se pudo editar un movimiento';
  exception when insufficient_privilege or sqlstate 'PV006' then
    ok := array_append(ok, 'un movimiento no se puede editar');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    delete from public.movimientos_stock where producto_id = coca;
    raise exception 'FAIL: se pudo borrar un movimiento';
  exception when insufficient_privilege or sqlstate 'PV006' then
    ok := array_append(ok, 'un movimiento no se puede borrar');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, usuario_id)
    values (comercio, coca, 'ingreso', 5, cajero);
    raise exception 'FAIL: el cajero pudo cargar un ingreso';
  exception when insufficient_privilege then
    ok := array_append(ok, 'el cajero no puede cargar ingresos ni ajustes');
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  select count(*) into n from public.movimientos_stock;
  execute 'reset role';
  if n <> 0 then
    raise exception 'FAIL: el cajero ve % movimientos', n;
  end if;
  ok := array_append(ok, 'el cajero no ve el historial de movimientos');

  select count(*) into n from public.movimientos_stock where producto_id = coca;
  if n <> movs2 or (select stock_actual from public.productos where id = coca) <> stock2 then
    raise exception 'FAIL: un intento rechazado cambió el stock o dejó movimientos';
  end if;
  ok := array_append(ok, 'los intentos rechazados no dejaron rastro');

  -- Abortar a propósito: revierte fixtures, usuarios y movimientos de prueba.
  raise exception using
    errcode = 'PV999',
    message = format('VALIDACION OK (todo revertido): %s checks', array_length(ok, 1)),
    detail = array_to_string(ok, E'\n');
end
$$;
