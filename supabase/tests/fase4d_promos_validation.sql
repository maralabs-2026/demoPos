-- Validación de la Fase 4d: promociones automáticas en registrar_venta (0013).
-- Necesita las migraciones 0001-0013 y el seed base (comercio "Kiosko Demo", Coca-Cola a $ 2.500).
--
--   supabase db query --linked -f supabase/tests/fase4d_promos_validation.sql
--
-- Un único bloque DO: crea sus usuarios, cajas y promos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT).

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000008d1';
  cajero constant uuid := '00000000-0000-4000-8000-0000000008c3';
  comercio uuid;
  coca uuid;
  categoria uuid;
  precio numeric;
  efectivo uuid;
  caja_dueno uuid;
  caja_cajero uuid;
  dow_hoy integer;
  dow_otro integer;
  p_2x1 uuid;
  p_3x6000 uuid;
  p_pct20 uuid;
  p_off uuid;
  resultado jsonb;
  item record;
  v_nombre text;
  ok text[] := '{}';
begin
  -- -------------------------------------------------------------------------------------------
  -- Fixtures (como postgres)
  -- -------------------------------------------------------------------------------------------
  if not exists (select 1 from pg_proc where proname = 'descuento_promocion') then
    raise exception 'FAIL: falta la función descuento_promocion (aplicar la migración 0013)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id, categoria_id, productos.precio into coca, categoria, precio
    from public.productos where comercio_id = comercio and codigo_barras = '7790010000154';
  select id into efectivo
    from public.medios_pago where comercio_id = comercio and tipo = 'efectivo' and activo limit 1;
  if comercio is null or coca is null or categoria is null or efectivo is null then
    raise exception 'FAIL: faltan el comercio, la Coca-Cola con categoría o el medio efectivo';
  end if;
  if precio <> 2500 then
    raise exception 'FAIL: el script asume la Coca-Cola a $ 2.500 (tiene %)', precio;
  end if;

  -- Día de la semana de hoy en Córdoba (0 = domingo) y otro día distinto.
  dow_hoy := extract(dow from now() at time zone 'America/Argentina/Cordoba')::integer;
  dow_otro := (dow_hoy + 1) % 7;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
     'dueno.promo@test.invalid', '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cajero, 'authenticated', 'authenticated',
     'cajero.promo@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño promo (test)'),
    (cajero, comercio, 'cajero', 'Cajero promo (test)');
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, dueno, 0) returning id into caja_dueno;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 0) returning id into caja_cajero;
  update public.configuracion set valor = '10'::jsonb
   where comercio_id = comercio and clave = 'descuento_max_cajero_pct';

  -- Promos de prueba (como postgres). Todas los días y en horario completo salvo P_OFF.
  insert into public.promociones (comercio_id, nombre, tipo, alcance, producto_id, lleva, paga)
  values (comercio, 'Coca 2x1', 'nxm', 'producto', coca, 2, 1) returning id into p_2x1;
  insert into public.promociones (comercio_id, nombre, tipo, alcance, producto_id, cantidad, precio)
  values (comercio, 'Coca 3 por 6000', 'precio_cantidad', 'producto', coca, 3, 6000)
  returning id into p_3x6000;
  insert into public.promociones (comercio_id, nombre, tipo, alcance, categoria_id, porcentaje)
  values (comercio, 'Bebidas 20 %', 'porcentaje', 'categoria', categoria, 20) returning id into p_pct20;
  -- Válida solo otro día de la semana: nunca debe aplicarse hoy.
  insert into public.promociones (comercio_id, nombre, tipo, alcance, producto_id, porcentaje, dias)
  values (comercio, 'Coca 90 % otro día', 'porcentaje', 'producto', coca, 90,
          array[dow_otro]::smallint[]) returning id into p_off;

  -- -------------------------------------------------------------------------------------------
  -- (a) El dueño lleva 2: el 2x1 gana, total $ 2.500, y queda guardado como snapshot.
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resultado := public.registrar_venta(
    caja_dueno,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2500, 'recibido', 2500)));
  execute 'reset role';
  select * into item from public.venta_items where venta_id = (resultado ->> 'venta_id')::uuid;
  if (resultado ->> 'total')::numeric <> 2500 or item.promocion_descuento <> 2500
     or item.promocion_nombre <> 'Coca 2x1' or item.descuento <> 2500 then
    raise exception 'FAIL: el 2x1 no se aplicó (resultado %, ítem %)', resultado, item;
  end if;
  ok := array_append(ok, 'el 2x1 se aplica solo: 2 Coca cobran $ 2.500 y el ítem guarda la promo');

  -- -------------------------------------------------------------------------------------------
  -- (b) Entre varias promos gana la de mayor descuento: con 3 unidades, precio por cantidad.
  -- -------------------------------------------------------------------------------------------
  update public.promociones set activa = false where id in (p_2x1, p_pct20);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resultado := public.registrar_venta(
    caja_dueno,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 3)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 6000, 'recibido', 6000)));
  execute 'reset role';
  if (resultado ->> 'total')::numeric <> 6000 then
    raise exception 'FAIL: 3 por $ 6.000 dio % en vez de 6000', resultado;
  end if;
  ok := array_append(ok, 'precio por cantidad: 3 Coca cobran $ 6.000');
  update public.promociones set activa = true where id in (p_2x1, p_pct20);

  -- -------------------------------------------------------------------------------------------
  -- (c) La promo de otro día no se aplica: 2 Coca cobran $ 2.500 por el 2x1 y no $ 500.
  -- -------------------------------------------------------------------------------------------
  -- Ya cubierto en (a): con P_OFF (90 %) vigente hoy el total habría sido $ 500.
  ok := array_append(ok, 'una promo de otro día de la semana no se aplica hoy');

  -- -------------------------------------------------------------------------------------------
  -- (d) Promo y descuento manual se suman: 2x1 de $ 2.500 y 10 % manual sobre lo que queda.
  -- -------------------------------------------------------------------------------------------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  resultado := public.registrar_venta(
    caja_cajero,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2, 'descuento_pct', 10)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2250, 'recibido', 2250)));
  execute 'reset role';
  select * into item from public.venta_items where venta_id = (resultado ->> 'venta_id')::uuid;
  if (resultado ->> 'total')::numeric <> 2250 or item.promocion_descuento <> 2500
     or item.descuento <> 2750 then
    raise exception 'FAIL: promo + manual no se sumaron (resultado %, ítem %)', resultado, item;
  end if;
  ok := array_append(ok, 'promo y 10 % manual se suman: $ 2.250 a cobrar');

  -- -------------------------------------------------------------------------------------------
  -- (e) El tope del cajero sigue siendo solo manual: la promo no cuenta para el 10 %.
  -- -------------------------------------------------------------------------------------------
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    perform public.registrar_venta(
      caja_cajero,
      jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2, 'descuento_pct', 11)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 2000)));
    raise exception 'FAIL: el cajero pasó el 10 %% manual con una promo activa';
  exception when sqlstate 'PV011' then
    execute 'reset role';
    ok := array_append(ok, 'el tope del cajero no cuenta la promo: 11 % manual sigue rechazado');
  end;

  -- -------------------------------------------------------------------------------------------
  -- (f) El cajero no puede crear ni cambiar promociones (RLS).
  -- -------------------------------------------------------------------------------------------
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
    insert into public.promociones (comercio_id, nombre, tipo, alcance, producto_id, porcentaje)
    values (comercio, 'Trampa', 'porcentaje', 'producto', coca, 50);
    execute 'reset role';
    raise exception 'FAIL: el cajero creó una promoción';
  exception when sqlstate '42501' then
    execute 'reset role';
    ok := array_append(ok, 'el cajero no puede crear promociones');
  end;

  -- -------------------------------------------------------------------------------------------
  -- (g) El snapshot no cambia cuando la promo se renombra o se desactiva después de vender.
  -- -------------------------------------------------------------------------------------------
  update public.promociones set nombre = 'Renombrada', activa = false where id = p_2x1;
  select promocion_nombre into v_nombre from public.venta_items
   where venta_id = (resultado ->> 'venta_id')::uuid;
  if v_nombre is distinct from 'Coca 2x1' then
    raise exception 'FAIL: el snapshot de la promo cambió al editar la promo';
  end if;
  ok := array_append(ok, 'editar o desactivar una promo no cambia las ventas ya cobradas');

  raise exception using
    errcode = 'PV999',
    message = format('VALIDACION OK (todo revertido): %s checks', array_length(ok, 1)),
    detail = array_to_string(ok, E'\n');
end
$$;
