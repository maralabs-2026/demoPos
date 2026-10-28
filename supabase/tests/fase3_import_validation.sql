-- Validación de la Fase 3: importación desde CSV (importar_productos, 0011) y la validación de
-- la fase en CLAUDE.md: "importar el CSV de seed, subir 10% una categoría y verificar en base que
-- solo esa categoría cambió".
-- Necesita las migraciones 0001-0011 y el seed base (comercio "Kiosko Demo" y sus productos).
-- Es SQL puro, así que corre igual por psql o por la API del CLI:
--
--   supabase db query --linked -f supabase/tests/fase3_import_validation.sql
--   psql "<connection-string>" -X -f supabase/tests/fase3_import_validation.sql
--
-- Es un único bloque DO: crea sus propios usuarios de prueba y, al terminar, SIEMPRE aborta con
-- una excepción. Así se revierte todo. El resultado viene en el mensaje:
--   "VALIDACION OK (todo revertido): ..." si pasó todo, o "FAIL: ..." en la primera falla.
-- Los roles se simulan como PostgREST: SET ROLE + claims JWT en request.jwt.claims.
-- El "CSV de seed" se arma desde los productos del seed con las mismas columnas que el archivo
-- (supabase/seed/productos.csv); la lectura del archivo en sí la cubren los tests de Vitest.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000006d1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000006c3';
  comercio_b constant uuid := '00000000-0000-4000-8000-00000000010b';
  categoria_b constant uuid := '00000000-0000-4000-8000-0000000001c1';
  producto_b constant uuid := '00000000-0000-4000-8000-0000000001b1';
  comercio uuid;
  categoria uuid;
  categoria_nombre text;
  coca uuid;
  coca_categoria uuid;
  catalogo jsonb;
  n_seed integer;
  resultado jsonb;
  nuevo uuid;
  n integer;
  ok text[] := '{}';
begin
  -- -------------------------------------------------------------------------------------------
  -- Fixtures (como postgres)
  -- -------------------------------------------------------------------------------------------
  if not exists (select 1 from pg_proc where proname = 'importar_productos') then
    raise exception 'FAIL: falta la función importar_productos (aplicar la migración 0011)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el comercio "Kiosko Demo" (correr el seed base)';
  end if;
  select id, categoria_id into coca, coca_categoria
    from public.productos where comercio_id = comercio and codigo_barras = '7790010000154';
  if coca is null or coca_categoria is null then
    raise exception 'FAIL: falta el producto 7790010000154 con categoría (correr el seed base)';
  end if;
  -- Una categoría distinta de la de la Coca, con productos, para el 10 %.
  select c.id, c.nombre into categoria, categoria_nombre
    from public.categorias c
   where c.comercio_id = comercio and c.id <> coca_categoria
     and exists (select 1 from public.productos p where p.categoria_id = c.id)
   order by c.orden limit 1;
  if categoria is null then
    raise exception 'FAIL: faltan categorías con productos (correr el seed base)';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
     'dueno.import@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
     'cajero.import@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)');

  insert into public.comercios (id, nombre) values (comercio_b, 'Comercio B (test)');
  insert into public.categorias (id, comercio_id, nombre) values (categoria_b, comercio_b, 'Cat B');
  insert into public.productos (id, comercio_id, categoria_id, nombre, codigo_barras, precio, stock_minimo)
  values (producto_b, comercio_b, categoria_b, 'Producto de otro comercio', '9990000000001', 100, 0);

  insert into public.productos_costos (producto_id, comercio_id, costo) values (coca, comercio, 500);

  -- El catálogo del seed con las columnas del CSV, como lo mandaría la server action.
  select count(*), jsonb_agg(jsonb_build_object(
           'nombre', p.nombre, 'codigo_barras', p.codigo_barras, 'categoria', c.nombre,
           'precio', p.precio, 'costo', null, 'unidad_venta', p.unidad_venta,
           'stock_minimo', p.stock_minimo) order by p.codigo_barras)
    into n_seed, catalogo
    from public.productos p left join public.categorias c on c.id = p.categoria_id
   where p.comercio_id = comercio;

  -- -------------------------------------------------------------------------------------------
  -- (a) Alta y actualización en una sola importación
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resultado := public.importar_productos(jsonb_build_array(
    jsonb_build_object('nombre', 'Alfajor importado', 'codigo_barras', '9990000000201',
      'categoria', '  ' || upper(categoria_nombre) || ' ', 'precio', 1500, 'costo', 900,
      'unidad_venta', 'unidad', 'stock_minimo', 4),
    -- Producto existente: celdas de categoría y costo vacías.
    jsonb_build_object('nombre', 'Coca-Cola (importada)', 'codigo_barras', '7790010000154',
      'categoria', null, 'precio', 2999.99, 'costo', null,
      'unidad_venta', 'unidad', 'stock_minimo', 7)
  ));
  execute 'reset role';

  if resultado <> '{"creados": 1, "actualizados": 1}'::jsonb then
    raise exception 'FAIL: resultado inesperado de la importación: %', resultado;
  end if;
  ok := array_append(ok, 'una importación da de alta y actualiza, y cuenta cada caso');

  select id into nuevo from public.productos
   where comercio_id = comercio and codigo_barras = '9990000000201'
     and categoria_id = categoria and precio = 1500 and stock_actual = 0;
  if nuevo is null
     or (select costo from public.productos_costos where producto_id = nuevo) is distinct from 900 then
    raise exception 'FAIL: el alta no guardó producto, categoría y costo';
  end if;
  ok := array_append(ok, 'el alta resuelve la categoría por nombre sin importar mayúsculas ni espacios');

  if (select nombre from public.productos where id = coca) <> 'Coca-Cola (importada)'
     or (select precio from public.productos where id = coca) <> 2999.99
     or (select stock_minimo from public.productos where id = coca) <> 7 then
    raise exception 'FAIL: no se actualizó el producto existente';
  end if;
  ok := array_append(ok, 'un código existente actualiza nombre, precio y stock mínimo');

  if (select categoria_id from public.productos where id = coca) is distinct from coca_categoria
     or (select costo from public.productos_costos where producto_id = coca) is distinct from 500 then
    raise exception 'FAIL: una celda vacía borró la categoría o el costo cargados';
  end if;
  ok := array_append(ok, 'categoría y costo vacíos no borran los datos cargados');

  -- -------------------------------------------------------------------------------------------
  -- (b) Las importaciones inválidas no dejan rastro
  -- -------------------------------------------------------------------------------------------
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.importar_productos(jsonb_build_array(
      jsonb_build_object('nombre', 'Válido', 'codigo_barras', '9990000000202', 'categoria', null,
        'precio', 100, 'costo', null, 'unidad_venta', 'unidad', 'stock_minimo', 0),
      -- Sin tilde: no es la categoría "Almacén" (ni ninguna otra).
      jsonb_build_object('nombre', 'Con categoría mal escrita', 'codigo_barras', '9990000000203',
        'categoria', 'Categoria que no existe', 'precio', 100, 'costo', null,
        'unidad_venta', 'unidad', 'stock_minimo', 0)
    ));
    raise exception 'FAIL: se aceptó una categoría que no existe';
  exception when sqlstate 'PV008' then
    execute 'reset role';
    ok := array_append(ok, 'una categoría inexistente rechaza la importación');
  end;
  if exists (select 1 from public.productos where codigo_barras = '9990000000202') then
    raise exception 'FAIL: la importación rechazada dejó productos a medias';
  end if;
  ok := array_append(ok, 'una importación rechazada no guarda ninguna fila');

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.importar_productos(jsonb_build_array(
      jsonb_build_object('nombre', 'Cat de otro comercio', 'codigo_barras', '9990000000204',
        'categoria', 'Cat B', 'precio', 100, 'costo', null, 'unidad_venta', 'unidad',
        'stock_minimo', 0)
    ));
    raise exception 'FAIL: se usó una categoría de otro comercio';
  exception when sqlstate 'PV008' then
    execute 'reset role';
    ok := array_append(ok, 'no se puede usar una categoría de otro comercio');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.importar_productos(jsonb_build_array(
      jsonb_build_object('nombre', 'A', 'codigo_barras', '9990000000205', 'precio', 1,
        'unidad_venta', 'unidad', 'stock_minimo', 0),
      jsonb_build_object('nombre', 'B', 'codigo_barras', ' 9990000000205 ', 'precio', 2,
        'unidad_venta', 'unidad', 'stock_minimo', 0)
    ));
    raise exception 'FAIL: se aceptaron códigos repetidos';
  exception when sqlstate 'PV010' then
    execute 'reset role';
    ok := array_append(ok, 'rechaza códigos de barras repetidos en el archivo');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.importar_productos(jsonb_build_array(
      jsonb_build_object('nombre', 'Precio negativo', 'codigo_barras', '9990000000206',
        'precio', -1, 'unidad_venta', 'unidad', 'stock_minimo', 0)
    ));
    raise exception 'FAIL: se aceptó un precio negativo';
  exception when sqlstate 'PV010' then
    execute 'reset role';
  end;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.importar_productos(jsonb_build_array(
      jsonb_build_object('nombre', 'Stock con texto', 'codigo_barras', '9990000000207',
        'precio', 10, 'unidad_venta', 'unidad', 'stock_minimo', 'muchos')
    ));
    raise exception 'FAIL: se aceptó un stock mínimo que no es número';
  exception when sqlstate 'PV010' then
    execute 'reset role';
  end;
  ok := array_append(ok, 'rechaza precios negativos y números inválidos');

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.importar_productos('[]'::jsonb);
    raise exception 'FAIL: se aceptó una importación vacía';
  exception when sqlstate 'PV010' then
    execute 'reset role';
    ok := array_append(ok, 'rechaza una importación vacía');
  end;

  -- -------------------------------------------------------------------------------------------
  -- (c) Rol y comercio
  -- -------------------------------------------------------------------------------------------
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    perform public.importar_productos(jsonb_build_array(
      jsonb_build_object('nombre', 'Del cajero', 'codigo_barras', '9990000000208',
        'precio', 10, 'unidad_venta', 'unidad', 'stock_minimo', 0)
    ));
    raise exception 'FAIL: el cajero pudo importar productos';
  exception when insufficient_privilege then
    execute 'reset role';
    ok := array_append(ok, 'el cajero no puede importar');
  end;

  -- El mismo código que un producto del comercio B: en el comercio A es un alta, y el de B no cambia.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resultado := public.importar_productos(jsonb_build_array(
    jsonb_build_object('nombre', 'Mismo código que B', 'codigo_barras', '9990000000001',
      'precio', 50, 'unidad_venta', 'unidad', 'stock_minimo', 0)
  ));
  execute 'reset role';
  if resultado <> '{"creados": 1, "actualizados": 0}'::jsonb
     or (select precio from public.productos where id = producto_b) <> 100
     or (select nombre from public.productos where id = producto_b) <> 'Producto de otro comercio' then
    raise exception 'FAIL: la importación tocó el producto de otro comercio (%)', resultado;
  end if;
  ok := array_append(ok, 'un código igual al de otro comercio no toca ese comercio');

  -- -------------------------------------------------------------------------------------------
  -- (d) Validación de la Fase 3: importar el CSV de seed y subir 10 % una categoría
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resultado := public.importar_productos(catalogo);
  execute 'reset role';
  if resultado <> jsonb_build_object('creados', 0, 'actualizados', n_seed) then
    raise exception 'FAIL: reimportar el catálogo del seed (% productos) dio %', n_seed, resultado;
  end if;
  ok := array_append(ok, format('el CSV de seed (%s productos) se importa: todos actualizados, ninguno duplicado', n_seed));

  create temp table precios_antes on commit drop as
    select id, categoria_id, precio from public.productos where comercio_id = comercio;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  n := public.actualizar_precios(categoria, 10);
  execute 'reset role';

  if n = 0 or n <> (select count(*) from precios_antes where categoria_id = categoria) then
    raise exception 'FAIL: el 10 %% no alcanzó a toda la categoría (% productos)', n;
  end if;
  if exists (
    select 1 from precios_antes a join public.productos p on p.id = a.id
     where a.categoria_id = categoria and p.precio <> round(a.precio * 1.10, 2)
  ) then
    raise exception 'FAIL: algún precio de la categoría no subió exactamente 10 %%';
  end if;
  if exists (
    select 1 from precios_antes a join public.productos p on p.id = a.id
     where a.categoria_id is distinct from categoria and p.precio <> a.precio
  ) then
    raise exception 'FAIL: cambió el precio de un producto de otra categoría';
  end if;
  ok := array_append(ok, format('subir 10 %% "%s" cambia solo esa categoría (%s productos)', categoria_nombre, n));

  -- Abortar a propósito: revierte fixtures, usuarios, productos y precios de prueba.
  raise exception using
    errcode = 'PV999',
    message = format('VALIDACION OK (todo revertido): %s checks', array_length(ok, 1)),
    detail = array_to_string(ok, E'\n');
end
$$;
