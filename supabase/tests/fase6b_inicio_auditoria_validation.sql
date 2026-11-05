-- Validación del inicio y la auditoría de stock (0022).
-- Necesita las migraciones 0001-0022 y el seed base (comercio "Kiosko Demo" y sus productos).
--
--   supabase db query --linked -f supabase/tests/fase6b_inicio_auditoria_validation.sql
--
-- Un único bloque DO: crea sus usuarios y datos de prueba y SIEMPRE aborta con
-- "PV999: VALIDACION OK (todo revertido)" para no dejar rastro. Los roles se simulan como
-- PostgREST (SET ROLE + claims JWT). Nunca correrlo en producción.

do $$
declare
  dueno constant uuid := '00000000-0000-4000-8000-0000000022a1';
  encargado constant uuid := '00000000-0000-4000-8000-0000000022a2';
  cajero constant uuid := '00000000-0000-4000-8000-0000000022a3';
  dueno_otro constant uuid := '00000000-0000-4000-8000-0000000022a5';
  hoy constant date := (now() at time zone 'America/Argentina/Cordoba')::date;
  comercio uuid;
  otro_comercio uuid;
  categoria uuid;
  otra_categoria uuid;
  sin_cambio uuid;
  faltante uuid;
  sobrante uuid;
  no_contado uuid;
  producto_ajeno uuid;
  caja_cajero uuid;
  caja_encargado uuid;
  gasto uuid;
  resumen jsonb;
  resultado jsonb;
  gastos_antes numeric;
  stock_no_contado integer;
  filas integer;
  ok text[] := '{}';
begin
  if to_regprocedure('public.aplicar_auditoria_stock(uuid, jsonb)') is null then
    raise exception 'FAIL: falta aplicar_auditoria_stock (aplicar la migración 0022)';
  end if;

  -- Fixtures (como postgres): una categoría propia con cuatro productos de stock conocido.
  select id into comercio from public.comercios where nombre = 'Kiosko Demo';
  if comercio is null then
    raise exception 'FAIL: falta el seed base';
  end if;

  insert into public.comercios (nombre) values ('Otro comercio (test auditoría)')
  returning id into otro_comercio;

  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{}', '{}', now(), now()
    from (values (dueno, 'dueno.audit@test.invalid'),
                 (encargado, 'encargado.audit@test.invalid'),
                 (cajero, 'cajero.audit@test.invalid'),
                 (dueno_otro, 'dueno.otro.audit@test.invalid')) as u (id, email);
  insert into public.perfiles (id, comercio_id, rol, nombre) values
    (dueno, comercio, 'dueno', 'Dueño (test)'),
    (encargado, comercio, 'encargado', 'Encargado (test)'),
    (cajero, comercio, 'cajero', 'Cajero (test)'),
    (dueno_otro, otro_comercio, 'dueno', 'Dueño de otro comercio (test)');

  insert into public.categorias (comercio_id, nombre) values (comercio, 'Auditoría (test)')
  returning id into categoria;
  insert into public.categorias (comercio_id, nombre) values (comercio, 'Otra (test)')
  returning id into otra_categoria;

  insert into public.productos (comercio_id, categoria_id, nombre, codigo_barras, precio, stock_minimo)
  values (comercio, categoria, 'Sin cambio (test)', '9990000000011', 100, 0) returning id into sin_cambio;
  insert into public.productos (comercio_id, categoria_id, nombre, codigo_barras, precio, stock_minimo)
  values (comercio, categoria, 'Faltante (test)', '9990000000012', 100, 20) returning id into faltante;
  insert into public.productos (comercio_id, categoria_id, nombre, codigo_barras, precio, stock_minimo)
  values (comercio, categoria, 'Sobrante (test)', '9990000000013', 100, 0) returning id into sobrante;
  insert into public.productos (comercio_id, categoria_id, nombre, codigo_barras, precio, stock_minimo)
  values (comercio, categoria, 'No contado (test)', '9990000000014', 100, 0) returning id into no_contado;
  insert into public.productos (comercio_id, categoria_id, nombre, codigo_barras, precio, stock_minimo)
  values (comercio, otra_categoria, 'Otra categoría (test)', '9990000000015', 100, 0)
  returning id into producto_ajeno;

  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  select comercio, p, 'ajuste', 10, 'Preparación', dueno
    from unnest(array[sin_cambio, faltante, sobrante, no_contado]) as p;

  -- (a) Una auditoría con diferencias: un ajuste por producto con diferencia, con su motivo.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  resultado := public.aplicar_auditoria_stock(categoria, jsonb_build_array(
    jsonb_build_object('producto_id', sin_cambio, 'contado', 10),
    jsonb_build_object('producto_id', faltante, 'contado', 7),
    jsonb_build_object('producto_id', sobrante, 'contado', 12)));
  execute 'reset role';

  if (select stock_actual from public.productos where id = faltante) <> 7
     or (select stock_actual from public.productos where id = sobrante) <> 12
     or (select stock_actual from public.productos where id = sin_cambio) <> 10 then
    raise exception 'FAIL (a): el stock no quedó como lo contado';
  end if;
  select count(*) into filas from public.movimientos_stock
   where producto_id in (sin_cambio, faltante, sobrante)
     and tipo = 'ajuste' and motivo = 'Auditoría de stock: Auditoría (test)' and usuario_id = encargado;
  if filas <> 2 then
    raise exception 'FAIL (a): hay % ajustes en vez de 2', filas;
  end if;
  if not exists (select 1 from public.movimientos_stock
                  where producto_id = faltante and cantidad = -3 and motivo like 'Auditoría%')
     or not exists (select 1 from public.movimientos_stock
                     where producto_id = sobrante and cantidad = 2 and motivo like 'Auditoría%') then
    raise exception 'FAIL (a): los ajustes no tienen la diferencia correcta';
  end if;
  if jsonb_array_length(resultado -> 'lineas') <> 3 then
    raise exception 'FAIL (a): el resultado no trae las tres líneas: %', resultado;
  end if;
  ok := ok || 'a: las diferencias generan un ajuste por producto con su motivo'::text;

  -- (b) Lo no contado no se toca.
  if (select stock_actual from public.productos where id = no_contado) <> 10
     or exists (select 1 from public.movimientos_stock
                 where producto_id = no_contado and motivo like 'Auditoría%') then
    raise exception 'FAIL (b): se tocó un producto que no se contó';
  end if;
  ok := ok || 'b: un producto no contado no se toca'::text;

  -- (c) Contar cero es válido y lleva el stock a cero.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform public.aplicar_auditoria_stock(categoria, jsonb_build_array(
    jsonb_build_object('producto_id', sobrante, 'contado', 0)));
  execute 'reset role';
  if (select stock_actual from public.productos where id = sobrante) <> 0 then
    raise exception 'FAIL (c): contar cero no llevó el stock a cero';
  end if;
  ok := ok || 'c: contar cero lleva el stock a cero'::text;

  -- (d) Conteos inválidos: rechazados, sin rastro.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  stock_no_contado := (select stock_actual from public.productos where id = no_contado);
  begin
    perform public.aplicar_auditoria_stock(categoria, '[]'::jsonb);
    raise exception 'FAIL (d): aceptó un conteo vacío';
  exception when sqlstate 'PV021' then
    null;
  end;
  begin
    perform public.aplicar_auditoria_stock(categoria, jsonb_build_array(
      jsonb_build_object('producto_id', no_contado, 'contado', -1)));
    raise exception 'FAIL (d): aceptó un negativo';
  exception when sqlstate 'PV021' then
    null;
  end;
  begin
    perform public.aplicar_auditoria_stock(categoria, jsonb_build_array(
      jsonb_build_object('producto_id', no_contado, 'contado', 'x')));
    raise exception 'FAIL (d): aceptó un texto';
  exception when sqlstate 'PV021' then
    null;
  end;
  begin
    perform public.aplicar_auditoria_stock(categoria, jsonb_build_array(
      jsonb_build_object('producto_id', no_contado, 'contado', 1),
      jsonb_build_object('producto_id', no_contado, 'contado', 2)));
    raise exception 'FAIL (d): aceptó un producto repetido';
  exception when sqlstate 'PV021' then
    null;
  end;
  begin
    perform public.aplicar_auditoria_stock(categoria, jsonb_build_array(
      jsonb_build_object('producto_id', no_contado, 'contado', 1),
      jsonb_build_object('producto_id', producto_ajeno, 'contado', 1)));
    raise exception 'FAIL (d): aceptó un producto de otra categoría';
  exception when sqlstate 'PV021' then
    null;
  end;
  begin
    perform public.aplicar_auditoria_stock(gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('producto_id', no_contado, 'contado', 1)));
    raise exception 'FAIL (d): aceptó una categoría inexistente';
  exception when sqlstate 'PV021' then
    null;
  end;
  execute 'reset role';
  if (select stock_actual from public.productos where id = no_contado) <> stock_no_contado then
    raise exception 'FAIL (d): un conteo rechazado dejó rastro';
  end if;
  ok := ok || 'd: un conteo inválido no deja rastro'::text;

  -- (e) Permisos: el cajero no audita ni ve el inicio, y otro comercio no opera.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  begin
    perform public.aplicar_auditoria_stock(categoria, jsonb_build_array(
      jsonb_build_object('producto_id', no_contado, 'contado', 1)));
    raise exception 'FAIL (e): el cajero auditó';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.inicio_resumen();
    raise exception 'FAIL (e): el cajero vio el inicio';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno_otro, 'role', 'authenticated')::text, true);
  begin
    perform public.aplicar_auditoria_stock(categoria, jsonb_build_array(
      jsonb_build_object('producto_id', no_contado, 'contado', 1)));
    raise exception 'FAIL (e): otro comercio auditó';
  exception when sqlstate 'PV021' then
    null;
  end;
  resumen := public.inicio_resumen();
  execute 'reset role';
  if jsonb_array_length(resumen -> 'cajas') <> 0 or (resumen -> 'reposicion')::int <> 0
     or (resumen -> 'hoy' ->> 'ventas')::int <> 0 then
    raise exception 'FAIL (e): otro comercio ve datos en el inicio: %', resumen;
  end if;
  ok := ok || 'e: cajero y otro comercio no auditan ni ven el inicio ajeno'::text;

  -- (f) Efectivo en caja: el dueño ve todas; el encargado, las de los demás y no la suya.
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, cajero, 1000) returning id into caja_cajero;
  insert into public.cajas (comercio_id, usuario_id, monto_inicial)
  values (comercio, encargado, 700) returning id into caja_encargado;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', encargado, 'role', 'authenticated')::text, true);
  resumen := public.inicio_resumen();
  perform public.registrar_movimiento_caja(caja_cajero, 'retiro', 100, 'Prueba actividad');
  execute 'reset role';
  if resumen -> 'cajas' @> jsonb_build_array(jsonb_build_object('caja_id', caja_encargado)) then
    raise exception 'FAIL (f): el encargado ve el efectivo de su propia caja';
  end if;
  if not (resumen -> 'cajas' @> jsonb_build_array(jsonb_build_object('caja_id', caja_cajero))) then
    raise exception 'FAIL (f): el encargado no ve la caja del cajero';
  end if;
  if (resumen ->> 'caja_propia_oculta')::boolean is not true then
    raise exception 'FAIL (f): no avisa que su caja está oculta';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resumen := public.inicio_resumen();
  execute 'reset role';
  if not (resumen -> 'cajas' @> jsonb_build_array(jsonb_build_object('caja_id', caja_encargado)))
     or not (resumen -> 'cajas' @> jsonb_build_array(
       jsonb_build_object('caja_id', caja_cajero, 'efectivo', 900))) then
    raise exception 'FAIL (f): el dueño no ve todas las cajas con su efectivo: %', resumen -> 'cajas';
  end if;
  if (resumen ->> 'caja_propia_oculta')::boolean then
    raise exception 'FAIL (f): al dueño no se le oculta nada';
  end if;
  ok := ok || 'f: el encargado no ve el efectivo de su caja; el dueño ve todas'::text;

  -- (g) Pendientes y actividad.
  if (resumen -> 'reposicion')::int < 1 then
    raise exception 'FAIL (g): no cuenta el producto bajo el mínimo';
  end if;
  if not (resumen -> 'actividad' @> jsonb_build_array(
    jsonb_build_object('tipo', 'retiro', 'detalle', 'Prueba actividad'))) then
    raise exception 'FAIL (g): la actividad no muestra el retiro';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  gastos_antes := (public.reporte_ventas(hoy, hoy) -> 'resumen' ->> 'gastos_pagados')::numeric;
  perform public.registrar_gasto('Vence pronto (test)', 'fijo', 500, hoy + 3, false);
  perform public.registrar_gasto('Vence lejos (test)', 'fijo', 500, hoy + 30, false);
  perform public.registrar_gasto('Sin vencimiento (test)', 'fijo', 500, null, false);
  perform public.registrar_gasto('Pagado por fuera (test)', 'variable', 250, null, true);
  gasto := public.registrar_gasto('Anulado (test)', 'variable', 999, null, true);
  perform public.anular_gasto(gasto);
  resumen := public.inicio_resumen();
  resultado := public.reporte_ventas(hoy, hoy);
  execute 'reset role';

  if not (resumen -> 'gastos' @> jsonb_build_array(jsonb_build_object('descripcion', 'Vence pronto (test)')))
     or resumen -> 'gastos' @> jsonb_build_array(jsonb_build_object('descripcion', 'Vence lejos (test)'))
     or resumen -> 'gastos' @> jsonb_build_array(jsonb_build_object('descripcion', 'Sin vencimiento (test)')) then
    raise exception 'FAIL (g): gastos por vencer: %', resumen -> 'gastos';
  end if;
  ok := ok || 'g: el inicio muestra reposición, gastos por vencer y actividad'::text;

  -- (h) Gastos pagados del reporte: suman los pagados, no los anulados ni los por pagar.
  if (resultado -> 'resumen' ->> 'gastos_pagados')::numeric <> gastos_antes + 250 then
    raise exception 'FAIL (h): gastos pagados % en vez de %',
      resultado -> 'resumen' ->> 'gastos_pagados', gastos_antes + 250;
  end if;
  ok := ok || 'h: el reporte cuenta solo los gastos pagados'::text;

  -- (i) Una caja cerrada con diferencia queda como pendiente.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    json_build_object('sub', cajero, 'role', 'authenticated')::text, true);
  perform public.cerrar_caja(caja_cajero, (
    select jsonb_agg(jsonb_build_object('medio_pago_id', m.id, 'contado', 0))
      from public.medios_pago m
     where m.comercio_id = comercio and m.activo));
  perform set_config('request.jwt.claims',
    json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  resumen := public.inicio_resumen();
  execute 'reset role';
  if not (resumen -> 'cajas_con_diferencia' @> jsonb_build_array(
    jsonb_build_object('caja_id', caja_cajero, 'diferencia', -900))) then
    raise exception 'FAIL (i): no aparece la caja con diferencia: %', resumen -> 'cajas_con_diferencia';
  end if;
  ok := ok || 'i: una caja cerrada con diferencia queda como pendiente'::text;

  raise exception 'PV999: VALIDACION OK (todo revertido). Casos: %', array_to_string(ok, ' | ');
end
$$;
