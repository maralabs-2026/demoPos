-- Validación de la Fase 1. Se ejecuta con psql (necesita \gset) contra una base que ya tiene
-- las migraciones 0001-0007, el seed base y supabase/seed_dev_users.sql:
--
--   psql "<connection-string>" -X -v ON_ERROR_STOP=1 -f supabase/tests/fase1_validation.sql
--
-- Todo corre dentro de una transacción que termina en ROLLBACK: no deja rastro. Cualquier
-- expectativa incumplida aborta el script con "FAIL: ..."; lo que pasa imprime "PASS: ...".
-- Los roles se simulan como lo hace PostgREST: SET ROLE + claims JWT en request.jwt.claims.

\set ON_ERROR_STOP on
\set QUIET on
begin;

create function pg_temp.assert_ok(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FAIL: %', msg;
  end if;
  raise notice 'PASS: %', msg;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Fixtures (como postgres): ids del comercio A, un segundo comercio B con un producto, etc.
-- ---------------------------------------------------------------------------------------------
select id as comercio_a from public.comercios where nombre = 'Kiosko Demo' \gset

insert into public.comercios (id, nombre)
values ('00000000-0000-4000-8000-00000000000b', 'Comercio B (test)');
insert into public.productos (id, comercio_id, nombre, codigo_barras, precio, stock_minimo)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b',
        'Producto de otro comercio', '9990000000001', 100, 0);

select id as coca from public.productos where codigo_barras = '7790010000154' \gset
select id as bic from public.productos where codigo_barras = '7790010000277' \gset
select id as brahma from public.productos where codigo_barras = '7790010000222' \gset
select id as efectivo from public.medios_pago where tipo = 'efectivo' \gset
select id as debito from public.medios_pago where nombre = 'Débito' \gset
select stock_actual as coca0 from public.productos where id = :'coca' \gset
select stock_actual as bic0 from public.productos where id = :'bic' \gset

-- Parámetros para los bloques DO (psql no interpola variables dentro de $$...$$).
select set_config('t.comercio_a', :'comercio_a', false),
       set_config('t.coca', :'coca', false),
       set_config('t.bic', :'bic', false),
       set_config('t.brahma', :'brahma', false),
       set_config('t.efectivo', :'efectivo', false),
       set_config('t.debito', :'debito', false) \gset

\set dueno '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}'
\set encargado '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}'
\set cajero '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}'

\echo
\echo '=== (a) Aislamiento entre comercios y permisos ==='

set local role authenticated;
select set_config('request.jwt.claims', :'cajero', true) \gset

select count(*) filter (where comercio_id = :'comercio_a') as propios,
       count(*) filter (where comercio_id <> :'comercio_a') as ajenos
  from public.productos \gset

select count(*) as perfiles_visibles from public.perfiles \gset

reset role;
select pg_temp.assert_ok(:propios = 40, 'el cajero ve los 40 productos de su comercio');
select pg_temp.assert_ok(:ajenos = 0, 'el cajero NO ve productos de otro comercio (0 filas)');
select pg_temp.assert_ok(:perfiles_visibles = 1, 'el cajero solo ve su propio perfil');

-- El dueño del comercio A intenta escribir en el comercio B.
set local role authenticated;
select set_config('request.jwt.claims', :'dueno', true) \gset
do $$
declare n integer;
begin
  begin
    insert into public.productos (comercio_id, nombre, codigo_barras, precio)
    values ('00000000-0000-4000-8000-00000000000b', 'intruso', '9990000000002', 1);
    raise exception 'FAIL: el dueño de A pudo insertar un producto en el comercio B';
  exception when insufficient_privilege then
    raise notice 'PASS: insertar un producto en otro comercio falla (RLS)';
  end;

  update public.productos set nombre = 'hackeado'
   where id = '00000000-0000-4000-8000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: el dueño de A modificó un producto del comercio B'; end if;
  raise notice 'PASS: modificar un producto de otro comercio afecta 0 filas';
end
$$;

-- Permisos por rol.
select set_config('request.jwt.claims', :'encargado', true) \gset
do $$
declare n integer;
begin
  update public.medios_pago set nombre = 'x' where comercio_id = current_setting('t.comercio_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: el encargado pudo editar medios de pago (configuración)'; end if;
  raise notice 'PASS: el encargado NO puede editar la configuración (medios de pago)';
end
$$;

select set_config('request.jwt.claims', :'cajero', true) \gset
do $$
begin
  begin
    update public.productos set stock_actual = 999 where id = current_setting('t.coca')::uuid;
    raise exception 'FAIL: el cajero pudo escribir stock_actual directamente';
  exception when insufficient_privilege then
    raise notice 'PASS: nadie escribe stock_actual a mano (solo el trigger)';
  end;

  begin
    insert into public.ventas (comercio_id, caja_id, usuario_id, total)
    values (current_setting('t.comercio_a')::uuid, gen_random_uuid(),
            '00000000-0000-4000-8000-0000000000c3', 1);
    raise exception 'FAIL: el cajero pudo insertar una venta sin pasar por registrar_venta';
  exception when insufficient_privilege then
    raise notice 'PASS: las ventas solo se crean con registrar_venta';
  end;
end
$$;

-- Anónimo: sin acceso a datos del negocio ni a la función.
set local role anon;
do $$
begin
  begin
    perform count(*) from public.ventas;
    raise exception 'FAIL: anon pudo leer ventas';
  exception when insufficient_privilege then
    raise notice 'PASS: anon no lee ventas';
  end;
  begin
    perform public.registrar_venta(gen_random_uuid(), '[]'::jsonb, '[]'::jsonb);
    raise exception 'FAIL: anon pudo ejecutar registrar_venta';
  exception when insufficient_privilege then
    raise notice 'PASS: anon no ejecuta registrar_venta';
  end;
  begin
    update public.productos set stock_actual = 999;
    raise exception 'FAIL: anon pudo modificar productos';
  exception when insufficient_privilege then
    raise notice 'PASS: anon no puede modificar stock (política demo eliminada)';
  end;
end
$$;
reset role;

\echo
\echo '=== (b) Venta correcta: baja el stock y suma la caja ==='

set local role authenticated;
select set_config('request.jwt.claims', :'cajero', true) \gset

insert into public.cajas (comercio_id, usuario_id, monto_inicial)
values (:'comercio_a', '00000000-0000-4000-8000-0000000000c3', 1000)
returning id as caja \gset

-- 2 Coca-Cola (2500) + 1 Encendedor (900) = 5900, paga $6000 en efectivo -> vuelto $100.
select public.registrar_venta(
  :'caja',
  jsonb_build_array(
    jsonb_build_object('producto_id', :'coca', 'cantidad', 2),
    jsonb_build_object('producto_id', :'bic', 'cantidad', 1)),
  jsonb_build_array(
    jsonb_build_object('medio_pago_id', :'efectivo', 'monto', 5900, 'recibido', 6000))
) as venta1 \gset

select (:'venta1'::jsonb ->> 'venta_id')::uuid as venta1_id,
       (:'venta1'::jsonb ->> 'total')::numeric as venta1_total,
       (:'venta1'::jsonb ->> 'vuelto')::numeric as venta1_vuelto \gset

-- El cajero ve el total de su caja (vista security_invoker, respeta RLS).
select coalesce(sum(total), 0) as caja_visible from public.caja_totales where caja_id = :'caja' \gset

reset role;
select stock_actual as coca1 from public.productos where id = :'coca' \gset
select stock_actual as bic1 from public.productos where id = :'bic' \gset
select count(*) as movs, coalesce(sum(cantidad), 0) as movs_sum
  from public.movimientos_stock where venta_id = :'venta1_id' and tipo = 'venta' \gset

select pg_temp.assert_ok(:venta1_total = 5900, 'total calculado en la base = 5900 (2x2500 + 900)');
select pg_temp.assert_ok(:venta1_vuelto = 100, 'vuelto = 100 (recibió 6000 por 5900)');
select pg_temp.assert_ok(:coca1 = :coca0 - 2, 'stock de Coca-Cola bajó 2 unidades');
select pg_temp.assert_ok(:bic1 = :bic0 - 1, 'stock de Encendedor bajó 1 unidad');
select pg_temp.assert_ok(:movs = 2 and :movs_sum = -3, 'se registraron 2 movimientos de venta (-3 unidades)');
select pg_temp.assert_ok(:caja_visible = 5900, 'la caja sumó 5900 (vista caja_totales)');
select pg_temp.assert_ok(
  (select count(*) from public.venta_items where venta_id = :'venta1_id'
     and precio_unitario in (2500, 900)) = 2,
  'los ítems guardan el precio como snapshot');
select pg_temp.assert_ok(
  (select bool_and(p.stock_actual = coalesce(m.s, 0))
     from public.productos p
     left join (select producto_id, sum(cantidad) s from public.movimientos_stock group by 1) m
       on m.producto_id = p.id),
  'stock_actual coincide con la suma de movimientos en TODOS los productos');

-- Pago combinado: 2 encendedores (1800) = 800 en efectivo (recibe 1000) + 1000 en débito.
set local role authenticated;
select set_config('request.jwt.claims', :'cajero', true) \gset
select public.registrar_venta(
  :'caja',
  jsonb_build_array(jsonb_build_object('producto_id', :'bic', 'cantidad', 2)),
  jsonb_build_array(
    jsonb_build_object('medio_pago_id', :'efectivo', 'monto', 800, 'recibido', 1000),
    jsonb_build_object('medio_pago_id', :'debito', 'monto', 1000))
) as venta2 \gset
select (:'venta2'::jsonb ->> 'vuelto')::numeric as venta2_vuelto \gset
select coalesce(sum(total) filter (where medio_pago_id = :'debito'), 0) as caja_debito,
       coalesce(sum(total), 0) as caja_total
  from public.caja_totales where caja_id = :'caja' \gset
reset role;
select pg_temp.assert_ok(:venta2_vuelto = 200, 'pago combinado: vuelto 200 sobre el tramo en efectivo');
select pg_temp.assert_ok(:caja_debito = 1000 and :caja_total = 7700,
  'pago combinado: la caja suma 1000 en débito y 7700 en total');

\echo
\echo '=== (c) Fallos limpios: sin rastro ==='

-- Foto del estado antes de los intentos fallidos.
select (select count(*) from public.ventas) as v,
       (select count(*) from public.venta_items) as i,
       (select count(*) from public.venta_pagos) as p,
       (select count(*) from public.movimientos_stock) as m,
       (select sum(stock_actual) from public.productos) as s \gset antes_

set local role authenticated;
select set_config('request.jwt.claims', :'cajero', true) \gset
select set_config('t.caja', :'caja', false) \gset

do $$
declare
  pago_coca jsonb := jsonb_build_array(jsonb_build_object(
    'medio_pago_id', current_setting('t.efectivo'), 'monto', 2500));
begin
  -- (c1) Stock insuficiente (Brahma tiene stock 0).
  begin
    perform public.registrar_venta(current_setting('t.caja')::uuid,
      jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.brahma'), 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', current_setting('t.efectivo'), 'monto', 2800)));
    raise exception 'FAIL: una venta sin stock NO falló';
  exception when sqlstate 'PV001' then
    raise notice 'PASS: (c1) stock insuficiente rechazado -> %', sqlerrm;
  end;

  -- (c2) Atomicidad: un ítem válido + uno sin stock -> no se toca ninguno.
  begin
    perform public.registrar_venta(current_setting('t.caja')::uuid,
      jsonb_build_array(
        jsonb_build_object('producto_id', current_setting('t.coca'), 'cantidad', 1),
        jsonb_build_object('producto_id', current_setting('t.brahma'), 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', current_setting('t.efectivo'), 'monto', 5300)));
    raise exception 'FAIL: la venta con un ítem sin stock NO falló';
  exception when sqlstate 'PV001' then
    raise notice 'PASS: (c2) venta mixta rechazada entera';
  end;

  -- (c3) Los pagos no cubren el total: falla al final, con ítems y movimientos ya insertados.
  begin
    perform public.registrar_venta(current_setting('t.caja')::uuid,
      jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.coca'), 'cantidad', 1)),
      jsonb_build_array(jsonb_build_object('medio_pago_id', current_setting('t.efectivo'), 'monto', 2000)));
    raise exception 'FAIL: una venta con pagos incompletos NO falló';
  exception when sqlstate 'PV003' then
    raise notice 'PASS: (c3) pagos que no cubren el total rechazados -> %', sqlerrm;
  end;

  -- (c4) Caja inexistente.
  begin
    perform public.registrar_venta(gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('producto_id', current_setting('t.coca'), 'cantidad', 1)),
      pago_coca);
    raise exception 'FAIL: una venta con caja inexistente NO falló';
  exception when sqlstate 'PV002' then
    raise notice 'PASS: (c4) caja inexistente rechazada';
  end;
end
$$;

reset role;
select (select count(*) from public.ventas) as v,
       (select count(*) from public.venta_items) as i,
       (select count(*) from public.venta_pagos) as p,
       (select count(*) from public.movimientos_stock) as m,
       (select sum(stock_actual) from public.productos) as s \gset despues_

select pg_temp.assert_ok(
  :antes_v = :despues_v and :antes_i = :despues_i and :antes_p = :despues_p
  and :antes_m = :despues_m and :antes_s = :despues_s,
  'los 4 intentos fallidos no dejaron ventas, ítems, pagos, movimientos ni cambios de stock');

\echo
\echo 'Todo OK. Se revierte la transacción (no queda ningún dato de prueba).'
rollback;
