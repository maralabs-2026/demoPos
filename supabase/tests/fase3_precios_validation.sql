-- Validación de la Fase 3: actualización masiva de precios.
-- Necesita las migraciones 0001-0009, y el seed base (comercio "Kiosko Demo" y sus productos).
-- Es SQL puro, así que corre igual por psql o por la API del CLI:
--
--   supabase db query --linked -f supabase/tests/fase3_precios_validation.sql
--   psql "<connection-string>" -X -f supabase/tests/fase3_precios_validation.sql
--
-- Es un único bloque DO: crea sus propios usuarios de prueba y, al terminar, SIEMPRE aborta con
-- una excepción. Así se revierte todo y no cambia ningún precio. El resultado viene en el mensaje:
--   "VALIDACION OK (todo revertido): ..." si pasó todo, o "FAIL: ..." en la primera falla.
-- Los roles se simulan como PostgREST: SET ROLE + claims JWT en request.jwt.claims.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000004d1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000004e2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000004c3';
  comercio_b constant uuid := '00000000-0000-4000-8000-00000000000b';
  categoria_b constant uuid := '00000000-0000-4000-8000-0000000000c1';
  producto_b constant uuid := '00000000-0000-4000-8000-0000000000b1';
  comercio uuid;
  categoria uuid;
  categoria_nombre text;
  en_categoria integer;
  en_comercio integer;
  n integer;
  ok text[] := '{}';
begin
  -- -------------------------------------------------------------------------------------------
  -- Fixtures (como postgres)
  -- -------------------------------------------------------------------------------------------
  if not exists (select 1 from pg_proc where proname = 'actualizar_precios') then
    raise exception 'FAIL: falta la función actualizar_precios (aplicar la migración 0009)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el comercio "Kiosko Demo" (correr el seed base)';
  end if;

  -- La categoría con más productos, para que la prueba toque varias filas.
  select c.id, c.nombre into categoria, categoria_nombre
    from public.categorias c
    join public.productos p on p.categoria_id = c.id
   where c.comercio_id = comercio
   group by c.id, c.nombre
   order by count(*) desc, c.nombre
   limit 1;
  if categoria is null then
    raise exception 'FAIL: "Kiosko Demo" no tiene categorías con productos (correr el seed base)';
  end if;
  select count(*) into en_categoria from public.productos where categoria_id = categoria;
  select count(*) into en_comercio from public.productos where comercio_id = comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
     'dueno.precios@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', encargado, 'authenticated', 'authenticated',
     'encargado.precios@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
     'cajero.precios@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)');

  insert into public.comercios (id, nombre) values (comercio_b, 'Comercio B (test)');
  insert into public.categorias (id, comercio_id, nombre) values (categoria_b, comercio_b, 'Cat B');
  insert into public.productos (id, comercio_id, categoria_id, nombre, codigo_barras, precio, stock_minimo)
  values (producto_b, comercio_b, categoria_b, 'Producto de otro comercio', '9990000000001', 100, 0);

  -- Foto de los precios antes de tocar nada.
  create temp table precios_antes on commit drop as
    select id, categoria_id, comercio_id, precio from public.productos;

  -- -------------------------------------------------------------------------------------------
  -- (a) El dueño sube 10 % una categoría: cambia solo esa categoría
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  n := public.actualizar_precios(categoria, 10);
  execute 'reset role';

  if n <> en_categoria then
    raise exception 'FAIL: se esperaban % productos actualizados y fueron %', en_categoria, n;
  end if;
  ok := array_append(ok, format('+10 %% a "%s": %s productos actualizados', categoria_nombre, n));

  select count(*) into n
    from public.productos p join precios_antes a on a.id = p.id
   where a.categoria_id = categoria and p.precio <> round(a.precio * 1.10, 2);
  if n <> 0 then
    raise exception 'FAIL: % productos de la categoría no quedaron en precio * 1,10', n;
  end if;
  ok := array_append(ok, 'cada producto de la categoría quedó en round(precio * 1,10, 2)');

  select count(*) into n
    from public.productos p join precios_antes a on a.id = p.id
   where a.categoria_id is distinct from categoria and p.precio <> a.precio;
  if n <> 0 then
    raise exception 'FAIL: cambiaron % productos fuera de la categoría', n;
  end if;
  ok := array_append(ok, 'ningún producto de otra categoría cambió');

  -- -------------------------------------------------------------------------------------------
  -- (b) Rechazos. Cada intento va en su propio bloque: al fallar se revierte solo ese intento
  -- (y su SET LOCAL ROLE), así que se vuelve a postgres automáticamente.
  -- -------------------------------------------------------------------------------------------
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    perform public.actualizar_precios(categoria, 10);
    raise exception 'FAIL: el cajero pudo cambiar precios';
  exception when insufficient_privilege then
    ok := array_append(ok, 'el cajero no puede cambiar precios');
  end;

  begin
    execute 'set local role anon';
    perform public.actualizar_precios(categoria, 10);
    raise exception 'FAIL: un usuario sin sesión pudo cambiar precios';
  exception when insufficient_privilege then
    ok := array_append(ok, 'sin sesión no se puede ejecutar la función');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.actualizar_precios(categoria, 0);
    raise exception 'FAIL: se aceptó un porcentaje 0';
  exception when sqlstate 'PV007' then
    ok := array_append(ok, 'rechaza un porcentaje 0');
  end;

  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
    perform public.actualizar_precios(categoria, 250);
    raise exception 'FAIL: se aceptó un porcentaje de 250';
  exception when sqlstate 'PV007' then
    ok := array_append(ok, 'rechaza un porcentaje fuera de rango');
  end;

  -- -------------------------------------------------------------------------------------------
  -- (c) Aislamiento entre comercios
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  n := public.actualizar_precios(categoria_b, 50);
  execute 'reset role';
  if n <> 0 or (select precio from public.productos where id = producto_b) <> 100 then
    raise exception 'FAIL: el dueño cambió precios de otro comercio';
  end if;
  ok := array_append(ok, 'no se pueden cambiar precios de una categoría de otro comercio');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  n := public.actualizar_precios(null, -5);
  execute 'reset role';
  if n <> en_comercio then
    raise exception 'FAIL: -5 %% al catálogo actualizó % productos y había %', n, en_comercio;
  end if;
  if (select precio from public.productos where id = producto_b) <> 100 then
    raise exception 'FAIL: -5 %% al catálogo cambió un producto de otro comercio';
  end if;
  ok := array_append(ok, format('el encargado baja -5 %% todo el catálogo: %s productos, otro comercio intacto', n));

  -- Abortar a propósito: revierte fixtures, usuarios y precios.
  raise exception using
    errcode = 'PV999',
    message = format('VALIDACION OK (todo revertido): %s checks', array_length(ok, 1)),
    detail = array_to_string(ok, E'\n');
end
$$;
