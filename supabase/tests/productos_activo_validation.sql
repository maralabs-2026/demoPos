-- Validación de los productos desactivados (0042).
-- Necesita las migraciones 0001-0042. Crea su propio comercio para no mezclarse con otros datos.
--
--   supabase db query --linked -f supabase/tests/productos_activo_validation.sql
--
-- Un único bloque DO que SIEMPRE aborta con "PV999: VALIDACION OK (todo revertido)" para no dejar
-- rastro. Los roles se simulan como PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000042a1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000042a2';
  offline constant uuid := '00000000-0000-4000-8000-0000000042b1';
  comercio uuid;
  agua uuid;
  efectivo uuid;
  caja uuid;
  filas integer;
  r jsonb;
  ok text[] := '{}';
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'activo') then
    raise exception 'FAIL: falta productos.activo (aplicar la migración 0042)';
  end if;

  insert into public.comercios (nombre) values ('Comercio productos activos (test)') returning id into comercio;
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
         u::text || '@test.invalid', '{}', '{}', now(), now()
    from unnest(array[dueno, cajero]) u;
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño (test)'), (cajero, comercio, 'cajero', 'Cajero (test)');
  insert into public.medios_pago (comercio_id, nombre, tipo) values (comercio, 'Efectivo', 'efectivo')
  returning id into efectivo;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial, abierta_at)
  values (comercio, cajero, 0, now() - interval '1 hour') returning id into caja;

  -- Agua: stock 5, mínimo 10 (cuenta para reponer mientras esté activa).
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  agua := public.guardar_producto(null, null, 'Agua (test)', '4200000000001', 800,
    'unidad', 10, null);
  execute 'reset role';
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  values (comercio, agua, 'ingreso', 5, null, dueno);

  -- (a) El cajero no puede desactivar (la RLS no le deja tocar ninguna fila); el dueño sí.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  update public.productos set activo = false where id = agua;
  get diagnostics filas = row_count;
  execute 'reset role';
  if filas <> 0 or not (select activo from public.productos where id = agua) then
    raise exception 'FAIL (a): el cajero desactivó el producto';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  r := public.inicio_resumen();
  if (r ->> 'reposicion')::integer <> 1 then
    raise exception 'FAIL (a): activo, reposicion = %', r ->> 'reposicion';
  end if;
  update public.productos set activo = false where id = agua;
  get diagnostics filas = row_count;
  execute 'reset role';
  if filas <> 1 or (select activo from public.productos where id = agua) then
    raise exception 'FAIL (a): el dueño no pudo desactivar';
  end if;
  ok := ok || 'a: solo dueño o encargado desactivan'::text;

  -- (b) Desactivado, no cuenta para reponer en el inicio.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  r := public.inicio_resumen();
  execute 'reset role';
  if (r ->> 'reposicion')::integer <> 0 then
    raise exception 'FAIL (b): inactivo, reposicion = %', r ->> 'reposicion';
  end if;
  ok := ok || 'b: no cuenta para reponer'::text;

  -- (c) Con conexión, venderlo falla sin dejar rastro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_venta(caja,
      jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 800)));
    raise exception 'FAIL (c): se vendió un producto desactivado';
  exception when sqlstate 'PV033' then null;
  end;
  execute 'reset role';
  if exists (select 1 from public.ventas where comercio_id = comercio)
     or (select stock_actual from public.productos where id = agua) <> 5 then
    raise exception 'FAIL (c): quedó rastro de la venta rechazada';
  end if;
  ok := ok || 'c: con conexión se rechaza sin rastro'::text;

  -- (d) Sin conexión entra igual (la mercadería ya se entregó), con el aviso 'inactivo'.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  r := public.registrar_venta_sin_conexion(offline, caja, now(),
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1, 'precio_unitario', 800)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 800)));
  execute 'reset role';
  if not (select avisos_sin_conexion @> array['inactivo'] from public.ventas where id = offline)
     or (select stock_actual from public.productos where id = agua) <> 4 then
    raise exception 'FAIL (d): avisos = %, stock = %',
      (select avisos_sin_conexion from public.ventas where id = offline),
      (select stock_actual from public.productos where id = agua);
  end if;
  ok := ok || 'd: sin conexión entra con aviso'::text;

  -- (e) Reactivado, se vende normalmente.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  update public.productos set activo = true where id = agua;
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  r := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', agua, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 800)));
  execute 'reset role';
  if (r ->> 'total')::numeric <> 800
     or (select stock_actual from public.productos where id = agua) <> 3 then
    raise exception 'FAIL (e): total = %', r ->> 'total';
  end if;
  ok := ok || 'e: reactivado se vende'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
