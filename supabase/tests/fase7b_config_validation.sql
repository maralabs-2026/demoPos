-- Validación de la configuración del comercio (0024).
-- Necesita las migraciones 0001-0024 y el seed base (comercio "Kiosko Demo" y sus productos).
--
--   supabase db query --linked -f supabase/tests/fase7b_config_validation.sql
--
-- Un único bloque DO: crea sus usuarios y datos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000024a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000024a2';
  dueno_ajeno constant uuid := '00000000-0000-4000-8000-0000000024a5';
  comercio uuid;
  otro_comercio uuid;
  efectivo uuid;
  segundo uuid;
  nuevo uuid;
  usado uuid;
  coca uuid;
  categoria uuid;
  categoria_vacia uuid;
  caja uuid;
  filas integer;
  ok text[] := '{}';
begin
  if to_regprocedure('public.medios_pago_proteger()') is null then
    raise exception 'FAIL: falta la migración 0024';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id into coca from public.productos
   where comercio_id = comercio and codigo_barras = '7790010000154';
  select categoria_id into categoria from public.productos where id = coca;
  if comercio is null or coca is null or categoria is null then
    raise exception 'FAIL: falta el seed base';
  end if;
  insert into public.comercios (nombre) values ('Otro comercio (test config)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.cfg@test.invalid'),
                 (encargado, 'encargado.cfg@test.invalid'),
                 (dueno_ajeno, 'ajeno.cfg@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (dueno_ajeno, otro_comercio, 'dueno', 'Dueño ajeno (test)');

  -- Queda un solo medio de efectivo activo para probar la protección.
  select id into efectivo from public.medios_pago
   where comercio_id = comercio and tipo = 'efectivo' and activo order by orden limit 1;
  update public.medios_pago set activo = false
   where comercio_id = comercio and tipo = 'efectivo' and id <> efectivo;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);

  -- (a) El dueño crea, renombra y desactiva un medio.
  insert into public.medios_pago (comercio_id, nombre, tipo, orden)
  values (comercio, 'Cuenta DNI (test)', 'qr', 99) returning id into nuevo;
  update public.medios_pago set nombre = 'Cuenta DNI 2 (test)' where id = nuevo;
  update public.medios_pago set activo = false where id = nuevo;
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (a): el dueño no desactivó el medio';
  end if;
  ok := ok || 'a: el dueño administra los medios de pago'::text;

  -- (b) Un medio no se borra.
  begin
    delete from public.medios_pago where id = nuevo;
    raise exception 'FAIL (b): se borró un medio de pago';
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'b: un medio de pago no se borra'::text;

  -- (c) Siempre queda un efectivo activo: desactivarlo o cambiarle el tipo falla sin rastro.
  begin
    update public.medios_pago set activo = false where id = efectivo;
    raise exception 'FAIL (c): se desactivó el último efectivo';
  exception when sqlstate 'PV022' then
    null;
  end;
  begin
    update public.medios_pago set tipo = 'qr' where id = efectivo;
    raise exception 'FAIL (c): se cambió el tipo del último efectivo';
  exception when sqlstate 'PV022' then
    null;
  end;
  -- Con otro efectivo activo, sí se puede.
  insert into public.medios_pago (comercio_id, nombre, tipo, orden)
  values (comercio, 'Efectivo 2 (test)', 'efectivo', 98) returning id into segundo;
  update public.medios_pago set activo = false where id = segundo;
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (c): no se pudo desactivar un efectivo de más';
  end if;
  ok := ok || 'c: siempre queda un medio de efectivo activo'::text;

  -- (d) El tipo de un medio con pagos no cambia.
  execute 'reset role';
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, coca, 'ajuste', 5, 'Validación config', dueno);
  update public.promociones set activa = false where comercio_id = comercio;
  update public.combos set activa = false where comercio_id = comercio;
  insert into public.medios_pago (comercio_id, nombre, tipo, orden)
  values (comercio, 'Con pagos (test)', 'tarjeta', 97) returning id into usado;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, dueno, 0) returning id into caja;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', usado, 'monto',
      (select precio from public.productos where id = coca))));
  begin
    update public.medios_pago set tipo = 'qr' where id = usado;
    raise exception 'FAIL (d): cambió el tipo de un medio con pagos';
  exception when sqlstate 'PV022' then
    null;
  end;
  update public.medios_pago set nombre = 'Renombrado con pagos (test)', activo = false where id = usado;
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (d): un medio con pagos no se pudo renombrar ni desactivar';
  end if;
  ok := ok || 'd: el tipo de un medio con pagos no cambia'::text;

  -- (e) Nombres: ni repetidos, ni vacíos, sin importar mayúsculas.
  begin
    insert into public.medios_pago (comercio_id, nombre, tipo)
    values (comercio, ' CUENTA dni 2 (TEST) ', 'qr');
    raise exception 'FAIL (e): se repitió un medio';
  exception when unique_violation then
    null;
  end;
  begin
    insert into public.categorias (comercio_id, nombre) values (comercio, '   ');
    raise exception 'FAIL (e): categoría vacía';
  exception when check_violation then
    null;
  end;
  ok := ok || 'e: los nombres no se repiten ni quedan vacíos'::text;

  -- (f) Categorías: una con productos no se borra; una vacía, sí.
  begin
    delete from public.categorias where id = categoria;
    raise exception 'FAIL (f): se borró una categoría con productos';
  exception when foreign_key_violation then
    null;
  end;
  insert into public.categorias (comercio_id, nombre) values (comercio, 'Vacía (test)')
  returning id into categoria_vacia;
  update public.categorias set nombre = 'Vacía 2 (test)' where id = categoria_vacia;
  delete from public.categorias where id = categoria_vacia;
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (f): no se borró una categoría vacía';
  end if;
  ok := ok || 'f: una categoría con productos no se borra'::text;

  -- (g) Los textos del ticket: el dueño los edita.
  update public.configuracion set valor = valor || '{"pie": "Volvé pronto (test)"}'
   where comercio_id = comercio and clave = 'ticket';
  get diagnostics filas = row_count;
  if filas <> 1 then
    raise exception 'FAIL (g): el dueño no editó el ticket';
  end if;
  ok := ok || 'g: el dueño edita los textos del ticket'::text;

  -- (h) El encargado lee pero no escribe.
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.medios_pago where id = efectivo) then
    raise exception 'FAIL (h): el encargado no lee los medios';
  end if;
  update public.medios_pago set nombre = 'Hackeado' where id = efectivo;
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (h): el encargado editó un medio';
  end if;
  update public.configuracion set valor = '{}' where comercio_id = comercio and clave = 'ticket';
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (h): el encargado editó el ticket';
  end if;
  begin
    insert into public.categorias (comercio_id, nombre) values (comercio, 'Del encargado (test)');
    raise exception 'FAIL (h): el encargado creó una categoría';
  exception when insufficient_privilege then
    null;
  end;
  ok := ok || 'h: el encargado no escribe la configuración'::text;

  -- (i) Otro comercio no ve ni toca.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_ajeno, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.medios_pago where id = efectivo) then
    raise exception 'FAIL (i): otro comercio ve el medio';
  end if;
  update public.categorias set nombre = 'Hackeada' where id = categoria;
  get diagnostics filas = row_count;
  if filas <> 0 then
    raise exception 'FAIL (i): otro comercio editó una categoría';
  end if;
  execute 'reset role';
  ok := ok || 'i: otro comercio no ve ni toca la configuración'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
