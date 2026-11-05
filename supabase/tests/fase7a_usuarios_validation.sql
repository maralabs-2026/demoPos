-- Validación de la administración de usuarios (0023).
-- Necesita las migraciones 0001-0023 y el seed base (comercio "Kiosko Demo").
--
--   supabase db query --linked -f supabase/tests/fase7a_usuarios_validation.sql
--
-- Un único bloque DO: crea sus usuarios y datos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000023a1';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000023a6';
  encargado constant uuid := '00000000-0000-4000-8000-0000000023a2';
  otro_encargado constant uuid := '00000000-0000-4000-8000-0000000023a7';
  cajero constant uuid := '00000000-0000-4000-8000-0000000023a3';
  nuevo constant uuid := '00000000-0000-4000-8000-0000000023a4';
  nuevo_dos constant uuid := '00000000-0000-4000-8000-0000000023a8';
  dueno_ajeno constant uuid := '00000000-0000-4000-8000-0000000023a5';
  comercio uuid;
  otro_comercio uuid;
  filas integer;
  ok text[] := '{}';
begin
  if to_regprocedure('public.listar_usuarios()') is null then
    raise exception 'FAIL: falta listar_usuarios (aplicar la migración 0023)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el seed base';
  end if;
  insert into public.comercios (nombre) values ('Otro comercio (test usuarios)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, u.meta::jsonb, '{}', now(), now()
    from (values (dueno, 'dueno.usr@test.invalid', '{}'),
                 (otro_dueno, 'otro.dueno.usr@test.invalid', '{}'),
                 (encargado, 'encargado.usr@test.invalid', '{}'),
                 (otro_encargado, 'otro.encargado.usr@test.invalid', '{}'),
                 (cajero, 'cajero.usr@test.invalid', '{"must_change_password": true}'),
                 (nuevo, 'nuevo.usr@test.invalid', '{}'),
                 (nuevo_dos, 'nuevo.dos.usr@test.invalid', '{}'),
                 (dueno_ajeno, 'ajeno.usr@test.invalid', '{}')) as u (id, email, meta);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (otro_dueno, comercio, 'dueno', 'Otro dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (otro_encargado, comercio, 'encargado', 'Otro encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (dueno_ajeno, otro_comercio, 'dueno', 'Dueño ajeno (test)');

  -- (a) El dueño lista a los de su comercio con el correo, sin los de otro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  if not exists (
    select 1 from public.listar_usuarios() u
     where u.id = cajero and u.email = 'cajero.usr@test.invalid'
       and u.contrasena_temporal and u.administrable
  ) then
    raise exception 'FAIL (a): el dueño no ve al cajero con sus datos';
  end if;
  if exists (select 1 from public.listar_usuarios() u where u.id = dueno_ajeno) then
    raise exception 'FAIL (a): se ve un usuario de otro comercio';
  end if;
  if exists (select 1 from public.listar_usuarios() u where u.id = dueno and u.administrable) then
    raise exception 'FAIL (a): el dueño figura como administrable por sí mismo';
  end if;
  ok := ok || 'a: lista los usuarios del comercio con su correo'::text;

  -- (b) El dueño administra a otros, incluso a otro dueño.
  update public.perfiles set nombre = 'Cambiado' where id = cajero;
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (b): el dueño no cambió al cajero';
  end if;
  update public.perfiles set activo = false where id = otro_dueno;
  get diagnostics filas = row_count;
  if filas <> 1 or not public.puede_administrar_usuario(otro_dueno) then
    raise exception 'FAIL (b): el dueño no administra a otro dueño';
  end if;
  insert into public.perfiles (id, comercio_id, rol, nombre) values (nuevo, comercio, 'encargado', 'Nuevo');
  ok := ok || 'b: el dueño administra a todos'::text;

  -- (c) Nadie se modifica a sí mismo, ni se puede dejar el comercio sin dueño activo.
  update public.perfiles set activo = false where id = dueno;
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (c): el dueño se desactivó a sí mismo';
  end if;
  update public.perfiles set rol = 'cajero' where id = dueno;
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (c): el dueño se cambió el rol';
  end if;
  if public.puede_administrar_usuario(dueno) then
    raise exception 'FAIL (c): puede_administrar_usuario da permiso sobre uno mismo';
  end if;
  execute 'reset role';
  if not exists (select 1 from public.perfiles where id = dueno and activo and rol = 'dueno') then
    raise exception 'FAIL (c): el dueño perdió su rol';
  end if;
  ok := ok || 'c: nadie se modifica a sí mismo'::text;

  -- (d) El encargado solo administra cajeros.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  update public.perfiles set nombre = 'Cambiado por encargado' where id = cajero;
  get diagnostics filas = row_count;
  if filas <> 1 or not public.puede_administrar_usuario(cajero) then
    raise exception 'FAIL (d): el encargado no administra al cajero';
  end if;
  update public.perfiles set activo = false where id in (otro_encargado, dueno, encargado);
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (d): el encargado modificó a % usuarios que no son cajeros', filas;
  end if;
  if public.puede_administrar_usuario(otro_encargado) or public.puede_administrar_usuario(dueno) then
    raise exception 'FAIL (d): puede_administrar_usuario da permiso de más';
  end if;
  ok := ok || 'd: el encargado solo administra cajeros'::text;

  -- (e) El encargado no asciende a un cajero ni crea otro rol.
  begin
    update public.perfiles set rol = 'encargado' where id = cajero;
    raise exception 'FAIL (e): el encargado ascendió a un cajero';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.perfiles (id, comercio_id, rol, nombre)
    values (nuevo_dos, comercio, 'encargado', 'Nuevo dos');
    raise exception 'FAIL (e): el encargado creó un encargado';
  exception when insufficient_privilege then
    null;
  end;
  insert into public.perfiles (id, comercio_id, rol, nombre) values (nuevo_dos, comercio, 'cajero', 'Nuevo dos');
  ok := ok || 'e: el encargado solo crea cajeros y no asciende'::text;

  -- (f) El cajero no administra ni lista.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform 1 from public.listar_usuarios();
    raise exception 'FAIL (f): el cajero listó usuarios';
  exception when insufficient_privilege then
    null;
  end;
  if public.puede_administrar_usuario(nuevo_dos) then
    raise exception 'FAIL (f): el cajero figura con permiso';
  end if;
  update public.perfiles set activo = false where id = nuevo_dos;
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (f): el cajero modificó a otro';
  end if;
  ok := ok || 'f: el cajero no administra ni lista'::text;

  -- (g) Otro comercio no administra ni crea acá.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_ajeno, 'role', 'authenticated')::text, true);
  if public.puede_administrar_usuario(cajero) then
    raise exception 'FAIL (g): otro comercio tiene permiso';
  end if;
  update public.perfiles set activo = false where id = cajero;
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (g): otro comercio modificó un usuario';
  end if;
  ok := ok || 'g: otro comercio no administra'::text;

  -- (h) Nadie borra perfiles, ni el dueño.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin
    delete from public.perfiles where id = cajero;
    raise exception 'FAIL (h): el dueño borró un perfil';
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'h: un usuario no se borra'::text;

  -- (i) Un usuario desactivado pierde el acceso a los datos, aunque su sesión siga viva.
  execute 'reset role';
  update public.perfiles set activo = false where id = encargado;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  if public.current_rol() is not null then
    raise exception 'FAIL (i): un desactivado conserva el rol';
  end if;
  begin
    perform 1 from public.listar_usuarios();
    raise exception 'FAIL (i): un desactivado listó usuarios';
  exception when insufficient_privilege then
    null;
  end;
  select count(*) into filas from public.ventas;
  if filas <> 0 then
    raise exception 'FAIL (i): un desactivado ve % ventas', filas;
  end if;
  execute 'reset role';
  ok := ok || 'i: un desactivado pierde el acceso a los datos'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
