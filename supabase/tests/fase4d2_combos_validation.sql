-- Validación de la Fase 4d-2: combo fijo en registrar_venta (0014 y 0015).
-- Necesita las migraciones 0001-0015 y el seed base (comercio "Kiosko Demo", Coca-Cola a $ 2.500).
--
--   supabase db query --linked -f supabase/tests/fase4d2_combos_validation.sql
--
-- Un único bloque DO: crea sus usuarios, cajas, promos y combos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Desactiva promos y combos existentes solo dentro de la
-- transacción.

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
  combo2_id uuid;
  combo_redondeo uuid;
  promo_id uuid;
  regalo constant uuid := '00000000-0000-4000-8000-0000000008a0';
  prod_a constant uuid := '00000000-0000-4000-8000-0000000008a1';
  prod_b constant uuid := '00000000-0000-4000-8000-0000000008a2';
  prod_c constant uuid := '00000000-0000-4000-8000-0000000008a3';
  repartos numeric[];
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

  -- Sin promos por línea ni otros combos: el efecto medido es solo el del combo de prueba.
  update public.promociones set activa = false where comercio_id = comercio;
  update public.combos set activa = false where comercio_id = comercio;

  -- Productos para el caso de redondeo: uno de regalo, con el menor id, y tres iguales.
  insert into public.productos (id, comercio_id, nombre, codigo_barras, precio)
  values (regalo, comercio, 'Regalo (test)', 'TEST-COMBO-0', 0),
         (prod_a, comercio, 'A (test)', 'TEST-COMBO-A', 10.01),
         (prod_b, comercio, 'B (test)', 'TEST-COMBO-B', 10.01),
         (prod_c, comercio, 'C (test)', 'TEST-COMBO-C', 10.01);

  -- Stock de sobra para que el script no dependa del seed.
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, usuario_id)
  select comercio, p, 'ingreso', 50, dueno
    from unnest(array[coca, otro, regalo, prod_a, prod_b, prod_c]) p;

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
  -- (f) Combo + promo: el 10 % de la Coca solo aplica a las dos unidades que no usó el combo.
  -- -------------------------------------------------------------------------------------------
  insert into public.promociones (comercio_id, nombre, tipo, alcance, producto_id, porcentaje)
  values (comercio, 'Promo test', 'porcentaje', 'producto', coca, 10) returning id into promo_id;
  esperado := combo_precio + 2 * coca_precio * 0.9;
  resultado := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 3),
                      jsonb_build_object('producto_id', otro, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', esperado,
                                         'recibido', esperado)));
  if (resultado ->> 'total')::numeric <> esperado then
    raise exception 'FAIL (f): esperado % y dio %', esperado, resultado;
  end if;
  select promocion_nombre into nombre_combo
    from public.venta_items
   where venta_id = (resultado ->> 'venta_id')::uuid and producto_id = coca;
  if nombre_combo <> 'Combo test + Promo test' then
    raise exception 'FAIL (f): snapshot de la promo incorrecto (%)', nombre_combo;
  end if;
  update public.promociones set activa = false where id = promo_id;
  ok := array_append(ok, 'combo + promo: la promo aplica solo a las unidades libres');

  -- -------------------------------------------------------------------------------------------
  -- (g) Combo + descuento manual: el 10 % se calcula sobre el precio ya con el combo.
  -- -------------------------------------------------------------------------------------------
  esperado := round(combo_precio * 0.9, 2);
  resultado := public.registrar_venta(caja,
    jsonb_build_array(
      jsonb_build_object('producto_id', coca, 'cantidad', 1, 'descuento_pct', 10),
      jsonb_build_object('producto_id', otro, 'cantidad', 1, 'descuento_pct', 10)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', esperado,
                                         'recibido', esperado)));
  if abs((resultado ->> 'total')::numeric - esperado) > 0.01 then
    raise exception 'FAIL (g): esperado % y dio %', esperado, resultado;
  end if;
  ok := array_append(ok, 'combo + manual: el descuento se suma sobre el precio del combo');

  -- -------------------------------------------------------------------------------------------
  -- (h) Dos combos en el ticket: cada uno usa sus unidades, sin reusarlas.
  -- -------------------------------------------------------------------------------------------
  insert into public.combos (comercio_id, nombre, precio, created_at)
  values (comercio, 'Combo test 2', coca_precio + 10.01 - 100, now() + interval '1 minute')
  returning id into combo2_id;
  insert into public.combo_items (combo_id, comercio_id, producto_id, cantidad)
  values (combo2_id, comercio, coca, 1), (combo2_id, comercio, prod_a, 1);
  esperado := combo_precio + coca_precio + 10.01 - 100;
  resultado := public.registrar_venta(caja,
    jsonb_build_array(jsonb_build_object('producto_id', coca, 'cantidad', 2),
                      jsonb_build_object('producto_id', otro, 'cantidad', 1),
                      jsonb_build_object('producto_id', prod_a, 'cantidad', 1)),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', esperado,
                                         'recibido', esperado)));
  if (resultado ->> 'total')::numeric <> esperado then
    raise exception 'FAIL (h): esperado % y dio %', esperado, resultado;
  end if;
  update public.combos set activa = false where id = combo2_id;
  ok := array_append(ok, 'dos combos: se aplican los dos sin reusar unidades');

  -- -------------------------------------------------------------------------------------------
  -- (i) Reparto al centavo con un regalo a $ 0. Mismos números que combos.test.ts.
  -- -------------------------------------------------------------------------------------------
  update public.combos set activa = false where id = combo_id;
  insert into public.combos (comercio_id, nombre, precio)
  values (comercio, 'Combo redondeo', 20) returning id into combo_redondeo;
  insert into public.combo_items (combo_id, comercio_id, producto_id, cantidad)
  select combo_redondeo, comercio, p, 1 from unnest(array[regalo, prod_a, prod_b, prod_c]) p;
  resultado := public.registrar_venta(caja,
    (select jsonb_agg(jsonb_build_object('producto_id', p, 'cantidad', 1))
       from unnest(array[regalo, prod_a, prod_b, prod_c]) p),
    jsonb_build_array(jsonb_build_object('medio_pago_id', efectivo, 'monto', 20, 'recibido', 20)));
  select array_agg(promocion_descuento order by producto_id) into repartos
    from public.venta_items where venta_id = (resultado ->> 'venta_id')::uuid;
  if repartos <> array[0, 3.34, 3.35, 3.34]::numeric[] then
    raise exception 'FAIL (i): reparto incorrecto (%)', repartos;
  end if;
  update public.combos set activa = false where id = combo_redondeo;
  update public.combos set activa = true where id = combo_id;
  ok := array_append(ok, 'reparto: al centavo, sin negativos y con un producto a $ 0');

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
