-- Validación de la Fase 4d-2: combo fijo en registrar_venta (0014).
-- Necesita las migraciones 0001-0014 y el seed base (comercio "Kiosko Demo", Coca-Cola a $ 2.500).
--
--   supabase db query --linked -f supabase/tests/fase4d2_combos_validation.sql
--
-- Un único bloque DO: crea sus usuarios, cajas, promos y combos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Desactiva las promos existentes solo dentro de la transacción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000008d2';
  comercio uuid;
  coca uuid;
  coca_precio numeric;
  otro uuid;
  otro_precio numeric;
  efectivo uuid;
  caja uuid;
  dow_hoy integer;
  dow_otro integer;
  combo_precio numeric;
  combo_id uuid;
  esperado numeric;
  resultado jsonb;
  descuentos numeric;
  nombre_combo text;
  ok text[] := '{}';
begin
  -- -------------------------------------------------------------------------------------------
  -- Fixtures (como postgres)
  -- -------------------------------------------------------------------------------------------
  if not exists (select 1 from pg_proc where proname = 'registrar_venta') then
    raise exception 'FAIL: falta registrar_venta';
  end if;
  if to_regclass('public.combos') is null then
    raise exception 'FAIL: falta la tabla combos (aplicar la migración 0014)';
  end if;

  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  select id, productos.precio into coca, coca_precio
    from public.productos where comercio_id = comercio and codigo_barras = '7790010000154';
  select id into efectivo
    from public.medios_pago where comercio_id = comercio and tipo = 'efectivo' and activo limit 1;
  if comercio is null or coca is null or efectivo is null then
    raise exception 'FAIL: faltan el comercio, la Coca-Cola o el medio efectivo';
  end if;
  if coca_precio <> 2500 then
    raise exception 'FAIL: el script asume la Coca-Cola a $ 2.500 (tiene %)', coca_precio;
  end if;

  -- Un segundo producto con stock, distinto de la Coca.
  select id, precio into otro, otro_precio
    from public.productos
   where comercio_id = comercio and id <> coca and stock_actual >= 10
   order by codigo_barras limit 1;
  if otro is null then
    raise exception 'FAIL: hace falta otro producto con stock >= 10';
  end if;

  dow_hoy := extract(dow from now() at time zone 'America/Argentina/Cordoba')::integer;
  dow_otro := (dow_hoy + 1) % 7;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', dueno, 'authenticated', 'authenticated',
          'dueno.combo@test.invalid', '{}', '{}', now(), now());
  insert into public.perfiles (id, comercio_id, rol, nombre)
  values (dueno, comercio, 'dueno', 'Dueño combo (test)');
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, dueno, 0) returning id into caja;

  -- Sin promos por línea: el efecto medido es solo el del combo.
  update public.promociones set activa = false where comercio_id = comercio;

  -- Combo Coca + otro producto, con $ 500 de descuento sobre la suma de precios.
  combo_precio := coca_precio + otro_precio - 500;
  insert into public.combos (comercio_id, nombre, precio)
  values (comercio, 'Combo test', combo_precio) returning id into combo_id;
  insert into public.combo_items (combo_id, comercio_id, producto_id, cantidad)
  values (combo_id, comercio, coca, 1), (combo_id, comercio, otro, 1);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);

  -- -------------------------------------------------------------------------------------------
  -- (a) Coca + otro: el combo se aplica y el total es su precio fijo.
  -- -------------------------------------------------------------------------------------------
  resultado := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1),
                      jsonb_build_object('producto_id', otro, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', combo_precio,
                                         'recibido', combo_precio)));
  if (resultado ->> 'total')::numeric <> combo_precio then
    raise exception 'FAIL (a): el total no es el precio del combo (%)', resultado;
  end if;
  select sum(descuento), max(promocion_nombre) into descuentos, nombre_combo
    from public.venta_items where venta_id = (resultado ->> 'venta_id')::uuid;
  if descuentos <> 500 or nombre_combo <> 'Combo test' then
    raise exception 'FAIL (a): descuento % o nombre % incorrectos', descuentos, nombre_combo;
  end if;
  ok := array_append(ok, 'combo: Coca + otro cobran el precio fijo y el snapshot guarda el nombre');

  -- -------------------------------------------------------------------------------------------
  -- (b) Dos Coca + un otro: un solo combo; la Coca sobrante va a precio de lista.
  -- -------------------------------------------------------------------------------------------
  esperado := combo_precio + coca_precio;
  resultado := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2),
                      jsonb_build_object('producto_id', otro, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', esperado,
                                         'recibido', esperado)));
  if (resultado ->> 'total')::numeric <> esperado then
    raise exception 'FAIL (b): esperado % y dio %', esperado, resultado;
  end if;
  ok := array_append(ok, 'combo: con dos Coca y un otro se aplica una sola vez');

  -- -------------------------------------------------------------------------------------------
  -- (c) Dos Coca + dos otro: dos combos completos.
  -- -------------------------------------------------------------------------------------------
  esperado := combo_precio * 2;
  resultado := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2),
                      jsonb_build_object('producto_id', otro, 'cantidad', 2)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', esperado,
                                         'recibido', esperado)));
  if (resultado ->> 'total')::numeric <> esperado then
    raise exception 'FAIL (c): esperado % y dio %', esperado, resultado;
  end if;
  ok := array_append(ok, 'combo: se aplican tantos combos completos como entren');

  -- -------------------------------------------------------------------------------------------
  -- (d) Solo Coca: el combo no aplica (faltan productos).
  -- -------------------------------------------------------------------------------------------
  resultado := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', coca_precio,
                                         'recibido', coca_precio)));
  if (resultado ->> 'total')::numeric <> coca_precio then
    raise exception 'FAIL (d): el combo se aplicó sin todos sus productos (%)', resultado;
  end if;
  ok := array_append(ok, 'combo: no se aplica si falta un producto');

  -- -------------------------------------------------------------------------------------------
  -- (e) Fuera de vigencia: el combo no se aplica hoy.
  -- -------------------------------------------------------------------------------------------
  update public.combos set dias = array[dow_otro]::smallint[] where id = combo_id;
  resultado := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 1),
                      jsonb_build_object('producto_id', otro, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', coca_precio + otro_precio,
                                         'recibido', coca_precio + otro_precio)));
  if (resultado ->> 'total')::numeric <> coca_precio + otro_precio then
    raise exception 'FAIL (e): el combo se aplicó fuera de su día (%)', resultado;
  end if;
  ok := array_append(ok, 'combo: respeta días de vigencia');

  execute 'reset role';

  -- Sin fallas: cierra con PV999 para revertir todo.
  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
