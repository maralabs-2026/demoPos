-- Validación de la foto de productos: columna y permisos de Storage (0016).
-- Necesita las migraciones 0001-0016 y el seed base (comercio "Kiosko Demo").
--
--   supabase db query --linked -f supabase/tests/productos_foto_validation.sql
--
-- Un único bloque DO: crea sus usuarios de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT).

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000016a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000016a2';
  otro_comercio constant uuid := '00000000-0000-4000-8000-0000000016a3';
  comercio uuid;
  producto uuid;
  filas integer;
  ok text[] := '{}';
begin
  if not exists (select 1 from storage.buckets where id = 'productos' and public) then
    raise exception 'FAIL: falta el bucket productos (aplicar la migración 0016)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id into producto from public.productos where comercio_id = comercio limit 1;
  if producto is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
     'dueno.foto@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
     'cajero.foto@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño foto (test)'),
         (cajero, comercio, 'cajero', 'Cajero foto (test)');

  -- (a) El dueño sube a la carpeta de su comercio y guarda la ruta.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);

  insert into storage.objects (bucket_id, name)
  values ('productos', comercio || '/' || producto || '/a.jpg');
  update public.productos set foto_path = comercio || '/' || producto || '/a.jpg'
   where id = producto;
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (a): el dueño no pudo guardar foto_path';
  end if;
  ok := ok || 'a: el dueño sube y guarda'::text;

  -- (b) El dueño no puede subir a la carpeta de otro comercio.
  begin
    insert into storage.objects (bucket_id, name)
    values ('productos', otro_comercio || '/' || producto || '/b.jpg');
    raise exception 'FAIL (b): el dueño subió a otro comercio';
  exception when insufficient_privilege then
    ok := ok || 'b: otro comercio rechazado'::text;
  end;

  -- (c) foto_path no puede apuntar fuera de su comercio.
  begin
    update public.productos set foto_path = otro_comercio || '/x.jpg' where id = producto;
    raise exception 'FAIL (c): foto_path apuntó a otro comercio';
  exception when check_violation then
    ok := ok || 'c: ruta ajena rechazada'::text;
  end;

  -- (d) El cajero lee el producto, pero no sube, no borra ni cambia la foto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);

  begin
    insert into storage.objects (bucket_id, name)
    values ('productos', comercio || '/' || producto || '/d.jpg');
    raise exception 'FAIL (d): el cajero subió una foto';
  exception when insufficient_privilege then
    ok := ok || 'd: cajero no sube'::text;
  end;

  -- Storage prohíbe el DELETE directo sobre storage.objects, para cualquier rol. Su API solo borra
  -- lo que el usuario puede ver, así que alcanza con que el cajero no vea los archivos.
  select count(*) into filas from storage.objects where bucket_id = 'productos';
  if filas <> 0 then
    raise exception 'FAIL (e): el cajero ve % fotos en Storage', filas;
  end if;
  ok := ok || 'e: cajero no ve los archivos para borrarlos'::text;

  update public.productos set foto_path = null where id = producto;
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (f): el cajero cambió foto_path';
  end if;
  if not exists (select 1 from public.productos where id = producto and foto_path is not null) then
    raise exception 'FAIL (f): el cajero no ve la foto del producto';
  end if;
  ok := ok || 'f: cajero no cambia foto_path'::text;

  execute 'reset role';

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
