-- Validación del logo y el nombre del comercio: columna, checks y permisos de Storage (0025).
-- Necesita las migraciones 0001-0025 y el seed base (comercio "Kiosko Demo").
--
--   supabase db query --linked -f supabase/tests/logo_comercio_validation.sql
--
-- Un único bloque DO: crea sus usuarios de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT).

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000025a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000025a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000025a3';
  otro_comercio constant uuid := '00000000-0000-4000-8000-0000000025a4';
  comercio uuid;
  quien uuid;
  filas integer;
  ok text[] := '{}';
begin
  if not exists (
    select 1 from storage.buckets
     where id = 'comercios' and public and 'image/png' = any (allowed_mime_types)
  ) then
    raise exception 'FAIL: falta el bucket comercios con PNG (aplicar la migración 0025)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
     'dueno.logo@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', encargado, 'authenticated', 'authenticated',
     'encargado.logo@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
     'cajero.logo@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño logo (test)'),
         (encargado, comercio, 'encargado', 'Encargado logo (test)'),
         (cajero, comercio, 'cajero', 'Cajero logo (test)');

  execute 'set local role authenticated';

  -- (a) El dueño sube el logo a la carpeta de su comercio, guarda la ruta y cambia el nombre.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);

  insert into storage.objects (bucket_id, name) values ('comercios', comercio || '/logo-a.png');
  update public.comercios
     set logo_path = comercio || '/logo-a.png', nombre = 'Zona 24/7'
   where id = comercio;
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (a): el dueño no pudo guardar el logo y el nombre';
  end if;
  ok := ok || 'a: el dueño sube el logo y cambia el nombre'::text;

  -- (b) No puede subir a la carpeta de otro comercio.
  begin
    insert into storage.objects (bucket_id, name) values ('comercios', otro_comercio || '/logo-b.png');
    raise exception 'FAIL (b): el dueño subió a otro comercio';
  exception when insufficient_privilege then
    ok := ok || 'b: otro comercio rechazado'::text;
  end;

  -- (c) logo_path no puede apuntar fuera de su comercio.
  begin
    update public.comercios set logo_path = otro_comercio || '/logo.png' where id = comercio;
    raise exception 'FAIL (c): logo_path apuntó a otro comercio';
  exception when check_violation then
    ok := ok || 'c: ruta ajena rechazada'::text;
  end;

  -- (d) El nombre no queda vacío ni pasa de 60 caracteres.
  begin
    update public.comercios set nombre = '   ' where id = comercio;
    raise exception 'FAIL (d): nombre vacío aceptado';
  exception when check_violation then
    null;
  end;
  begin
    update public.comercios set nombre = repeat('x', 61) where id = comercio;
    raise exception 'FAIL (d): nombre de 61 caracteres aceptado';
  exception when check_violation then
    ok := ok || 'd: nombre vacío o largo rechazado'::text;
  end;

  -- (e) El encargado y el cajero ven el comercio, pero no suben, no ven los archivos para borrar
  -- ni cambian el logo o el nombre.
  foreach quien in array array[encargado, cajero] loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', quien, 'role', 'authenticated')::text, true);

    begin
      insert into storage.objects (bucket_id, name) values ('comercios', comercio || '/logo-e.png');
      raise exception 'FAIL (e): un % subió un logo', (select rol from public.perfiles where id = quien);
    exception when insufficient_privilege then
      null;
    end;

    select count(*) into filas from storage.objects where bucket_id = 'comercios';
    if filas <> 0 then
      raise exception 'FAIL (e): un rol que no es dueño ve % archivos del logo', filas;
    end if;

    update public.comercios set logo_path = null, nombre = 'Otro' where id = comercio;
    get diagnostics filas = row_count;
    if filas <> 0 then
      raise exception 'FAIL (e): un rol que no es dueño cambió el comercio';
    end if;
    if not exists (
      select 1 from public.comercios
       where id = comercio and logo_path is not null and nombre = 'Zona 24/7'
    ) then
      raise exception 'FAIL (e): un rol que no es dueño no ve el logo y el nombre';
    end if;
  end loop;
  ok := ok || 'e: encargado y cajero ven, pero no suben ni cambian'::text;

  execute 'reset role';

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
