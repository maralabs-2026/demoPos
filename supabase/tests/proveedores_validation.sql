-- Validación de proveedores (0034).
-- Necesita las migraciones 0001-0034. Crea sus propios comercios para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/proveedores_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000034a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000034a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000034a3';
  otro_dueno constant uuid := '00000000-0000-4000-8000-0000000034a4';
  comercio uuid;
  otro uuid;
  prov uuid;
  ajeno uuid;
  producto uuid;
  n integer;
  ok text[] := '{}';
begin
  if to_regclass('public.proveedores') is null then
    raise exception 'FAIL: falta la tabla proveedores (aplicar la migración 0034)';
  end if;

  insert into public.comercios (nombre) values ('Comercio proveedores (test)') returning id into comercio;
  insert into public.comercios (nombre) values ('Otro comercio proveedores (test)') returning id into otro;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, encargado, cajero, otro_dueno]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'),
         (encargado, comercio, 'encargado', 'Encargado (test)'),
         (cajero, comercio, 'cajero', 'Cajero (test)'),
         (otro_dueno, otro, 'dueno', 'Otro dueño (test)');
  insert into public.proveedores (comercio_id, nombre) values (otro, 'Ajeno (test)') returning id into ajeno;

  -- (a) El encargado crea un proveedor.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  insert into public.proveedores (comercio_id, nombre, telefono)
  values (comercio, 'Distribuidora (test)', '5493511234567') returning id into prov;
  ok := ok || 'a: el encargado crea proveedores'::text;

  -- (b) El nombre no se repite, sin importar mayúsculas ni espacios; el teléfono es solo dígitos.
  begin
    insert into public.proveedores (comercio_id, nombre) values (comercio, '  distribuidora (TEST) ');
    raise exception 'FAIL (b): repitió el nombre';
  exception when unique_violation then null;
  end;
  begin
    insert into public.proveedores (comercio_id, nombre, telefono) values (comercio, 'Otro', '351-123');
    raise exception 'FAIL (b): aceptó un teléfono inválido';
  exception when check_violation then
    ok := ok || 'b: nombre único y teléfono válido'::text;
  end;

  -- (c) No se borra: sin permiso de DELETE.
  begin
    delete from public.proveedores where id = prov;
    raise exception 'FAIL (c): se borró un proveedor';
  exception when insufficient_privilege then
    ok := ok || 'c: no se borra'::text;
  end;

  -- (d) El cajero no lee ni crea.
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  select count(*) into n from public.proveedores;
  if n <> 0 then
    raise exception 'FAIL (d): el cajero leyó % proveedores', n;
  end if;
  begin
    insert into public.proveedores (comercio_id, nombre) values (comercio, 'Del cajero');
    raise exception 'FAIL (d): el cajero creó un proveedor';
  exception when insufficient_privilege then
    ok := ok || 'd: el cajero no accede'::text;
  end;

  -- (e) Otro comercio no lo ve ni lo edita.
  perform set_config('request.jwt.claims',
    json_build_object('sub', otro_dueno, 'role', 'authenticated')::text, true);
  select count(*) into n from public.proveedores where id = prov;
  update public.proveedores set nombre = 'Hackeado' where id = prov;
  execute 'reset role';
  if n <> 0 or (select nombre from public.proveedores where id = prov) <> 'Distribuidora (test)' then
    raise exception 'FAIL (e): otro comercio llegó al proveedor';
  end if;
  ok := ok || 'e: aislado por comercio'::text;

  -- (f) El producto guarda su proveedor habitual, y uno de otro comercio se rechaza.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  producto := public.guardar_producto(null, null, 'Agua (test)', '3400000000001', 800,
    'unidad', 0, null, null, null, true, false, prov);
  begin
    perform public.guardar_producto(producto, null, 'Agua (test)', '3400000000001', 800,
      'unidad', 0, null, 800, null, true, false, ajeno);
    raise exception 'FAIL (f): aceptó un proveedor de otro comercio';
  exception when foreign_key_violation then null;
  end;
  execute 'reset role';
  if (select proveedor_id from public.productos where id = producto) <> prov then
    raise exception 'FAIL (f): no guardó el proveedor';
  end if;
  ok := ok || 'f: proveedor habitual, solo del propio comercio'::text;

  -- (g) Se desactiva y el producto lo conserva.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  update public.proveedores set activo = false where id = prov;
  execute 'reset role';
  if (select activo from public.proveedores where id = prov)
     or (select proveedor_id from public.productos where id = producto) <> prov then
    raise exception 'FAIL (g): la desactivación no quedó bien';
  end if;
  ok := ok || 'g: se desactiva sin perder el vínculo'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
