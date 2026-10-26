-- Validación de la Fase 3: ABM de productos con costo (productos_costos + guardar_producto).
-- Necesita las migraciones 0001-0010 y el seed base (comercio "Kiosko Demo" y sus productos).
-- Es SQL puro, así que corre igual por psql o por la API del CLI:
--
--   supabase db query --linked -f supabase/tests/fase3_productos_validation.sql
--   psql "<connection-string>" -X -f supabase/tests/fase3_productos_validation.sql
--
-- Es un único bloque DO: crea sus propios usuarios de prueba y, al terminar, SIEMPRE aborta con
-- una excepción. Así se revierte todo. El resultado viene en el mensaje:
--   "VALIDACION OK (todo revertido): ..." si pasó todo, o "FAIL: ..." en la primera falla.
-- Los roles se simulan como PostgREST: SET ROLE + claims JWT en request.jwt.claims.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000005d1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000005e2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000005c3';
  comercio_b constant uuid := '00000000-0000-4000-8000-00000000000b';
  categoria_b constant uuid := '00000000-0000-4000-8000-0000000000c1';
  producto_b constant uuid := '00000000-0000-4000-8000-0000000000b1';
  comercio uuid;
  categoria uuid;
  coca uuid;
  nuevo uuid;
  otro uuid;
  n integer;
  v_costo numeric;
  v_precio numeric;
  ok text[] := '{}';
begin
  -- -------------------------------------------------------------------------------------------
  -- Fixtures (como postgres)
  -- -------------------------------------------------------------------------------------------
  if not exists (select 1 from pg_proc where proname = 'guardar_producto') then
    raise exception 'FAIL: falta la función guardar_producto (aplicar la migración 0010)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el comercio "Kiosko Demo" (correr el seed base)';
  end if;
  select id into categoria from public.categorias where comercio_id = comercio order by orden limit 1;
  select id into coca from public.productos where codigo_barras = '7790010000154';
  if categoria is null or coca is null then
    raise exception 'FAIL: faltan categorías o el producto 7790010000154 (correr el seed base)';
  end if;
  if not exists (select 1 from public.movimientos_stock where producto_id = coca) then
    raise exception 'FAIL: el producto 7790010000154 no tiene movimientos (correr el seed base)';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
     'dueno.abm@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', encargado, 'authenticated', 'authenticated',
     'encargado.abm@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
     'cajero.abm@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)');

  insert into public.comercios (id, nombre) values (comercio_b, 'Comercio B (test)');
  insert into public.categorias (id, comercio_id, nombre) values (categoria_b, comercio_b, 'Cat B');
  insert into public.productos (id, comercio_id, categoria_id, nombre, codigo_barras, precio, stock_minimo)
  values (producto_b, comercio_b, categoria_b, 'Producto de otro comercio', '9990000000001', 100, 0);

  -- -------------------------------------------------------------------------------------------
  -- (a) Alta y edición con costo
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  nuevo := public.guardar_producto(null, categoria, 'Alfajor test', '9990000000101', 1200, 'unidad', 5, 800);
  execute 'reset role';

  select c.costo, p.precio into v_costo, v_precio
    from public.productos p join public.productos_costos c on c.producto_id = p.id
   where p.id = nuevo and p.comercio_id = comercio and c.comercio_id = comercio;
  if v_costo is distinct from 800 or v_precio is distinct from 1200 then
    raise exception 'FAIL: el alta no guardó producto y costo juntos (costo %, precio %)', v_costo, v_precio;
  end if;
  ok := array_append(ok, 'el dueño da de alta un producto con costo, en su comercio');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  -- En una edición se pasan el precio y el costo que se vieron al abrir el formulario.
  perform public.guardar_producto(nuevo, categoria, 'Alfajor test', '9990000000101', 1300, 'unidad', 5, 850,
                                  1200, 800);
  execute 'reset role';

  select c.costo, p.precio into v_costo, v_precio
    from public.productos p join public.productos_costos c on c.producto_id = p.id where p.id = nuevo;
  if v_costo is distinct from 850 or v_precio is distinct from 1300 then
    raise exception 'FAIL: la edición no actualizó precio y costo (costo %, precio %)', v_costo, v_precio;
  end if;
  ok := array_append(ok, 'el encargado edita precio y costo');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.guardar_producto(nuevo, null, 'Alfajor test', '9990000000101', 1300, 'unidad', 5, null,
                                  1300, 850);
  execute 'reset role';
  if exists (select 1 from public.productos_costos where producto_id = nuevo) then
    raise exception 'FAIL: guardar con costo null no borró el costo';
  end if;
  ok := array_append(ok, 'guardar sin costo borra el costo cargado');
  if (select categoria_id from public.productos where id = nuevo) is not null then
    raise exception 'FAIL: no se pudo dejar el producto sin categoría';
  end if;
  ok := array_append(ok, 'un producto puede quedar sin categoría');

  -- Cambio simultáneo: el formulario se abrió con precio 1200, pero en la base ya es 1300
  -- (por ejemplo, una actualización masiva). La edición se rechaza y no pisa nada.
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
    perform public.guardar_producto(nuevo, categoria, 'Alfajor test', '9990000000101', 1200, 'unidad', 9, null,
                                    1200, null);
    raise exception 'FAIL: se aceptó una edición con un precio que otro usuario ya había cambiado';
  exception when sqlstate 'PV009' then
    ok := array_append(ok, 'rechaza una edición que pisaría un cambio de precio de otro usuario');
  end;
  if (select precio from public.productos where id = nuevo) <> 1300
     or (select stock_minimo from public.productos where id = nuevo) <> 5 then
    raise exception 'FAIL: la edición rechazada cambió el producto';
  end if;

  -- -------------------------------------------------------------------------------------------
  -- (b) El cajero no ve ni toca costos
  -- -------------------------------------------------------------------------------------------
  insert into public.productos_costos (producto_id, comercio_id, costo) values (coca, comercio, 500);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  select count(*) into n from public.productos_costos;
  if n <> 0 then
    raise exception 'FAIL: el cajero ve % costos', n;
  end if;
  select count(*) into n from public.productos;
  execute 'reset role';
  if n = 0 then
    raise exception 'FAIL: el cajero dejó de ver los productos';
  end if;
  ok := array_append(ok, format('el cajero ve los %s productos pero ningún costo', n));

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    update public.productos_costos set costo = 1 where producto_id = coca;
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'FAIL: el cajero modificó un costo';
    end if;
    insert into public.productos_costos (producto_id, comercio_id, costo) values (nuevo, comercio, 1);
    raise exception 'FAIL: el cajero cargó un costo';
  exception when insufficient_privilege then
    ok := array_append(ok, 'el cajero no puede cargar ni modificar costos');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    perform public.guardar_producto(null, categoria, 'Del cajero', '9990000000102', 10, 'unidad', 0, null);
    raise exception 'FAIL: el cajero dio de alta un producto';
  exception when insufficient_privilege then
    ok := array_append(ok, 'el cajero no puede dar de alta productos');
  end;

  begin
    execute 'set local role anon';
    perform public.guardar_producto(null, categoria, 'Sin sesión', '9990000000103', 10, 'unidad', 0, null);
    raise exception 'FAIL: un usuario sin sesión pudo ejecutar guardar_producto';
  exception when insufficient_privilege then
    ok := array_append(ok, 'sin sesión no se puede ejecutar la función');
  end;

  -- -------------------------------------------------------------------------------------------
  -- (c) Rechazos del alta y aislamiento entre comercios
  -- -------------------------------------------------------------------------------------------
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.guardar_producto(null, categoria, 'Repetido', '9990000000101', 10, 'unidad', 0, 5);
    raise exception 'FAIL: se aceptó un código de barras repetido';
  exception when unique_violation then
    ok := array_append(ok, 'rechaza un código de barras repetido');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.guardar_producto(null, categoria_b, 'Cat ajena', '9990000000104', 10, 'unidad', 0, null);
    raise exception 'FAIL: se aceptó una categoría de otro comercio';
  exception when sqlstate 'PV008' then
    ok := array_append(ok, 'rechaza una categoría de otro comercio');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.guardar_producto(producto_b, null, 'Hackeado', '9990000000001', 1, 'unidad', 0, 1,
                                    100, null);
    raise exception 'FAIL: se editó un producto de otro comercio';
  exception when sqlstate 'PV005' then
    ok := array_append(ok, 'no se puede editar un producto de otro comercio');
  end;
  if (select precio from public.productos where id = producto_b) <> 100
     or exists (select 1 from public.productos_costos where producto_id = producto_b) then
    raise exception 'FAIL: el producto del otro comercio cambió';
  end if;

  -- -------------------------------------------------------------------------------------------
  -- (d) Baja
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  otro := public.guardar_producto(null, categoria, 'Para borrar', '9990000000105', 10, 'unidad', 0, 7);
  delete from public.productos where id = otro;
  execute 'reset role';
  if exists (select 1 from public.productos where id = otro)
     or exists (select 1 from public.productos_costos where producto_id = otro) then
    raise exception 'FAIL: borrar el producto no borró su costo';
  end if;
  ok := array_append(ok, 'borrar un producto sin movimientos borra también su costo');

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    delete from public.productos where id = coca;
    raise exception 'FAIL: se borró un producto con movimientos de stock';
  exception when foreign_key_violation then
    ok := array_append(ok, 'no se puede borrar un producto con movimientos de stock');
  end;

  -- Abortar a propósito: revierte fixtures, usuarios, productos y costos de prueba.
  raise exception using
    errcode = 'PV999',
    message = format('VALIDACION OK (todo revertido): %s checks', array_length(ok, 1)),
    detail = array_to_string(ok, E'\n');
end
$$;
