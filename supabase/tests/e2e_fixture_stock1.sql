-- Fixture de e2e/stock-concurrencia.spec.ts: un producto con stock exactamente 1.
-- SOLO para la base de pruebas (kiosko-demo-test). Es idempotente: si el producto ya existe,
-- deja su stock en 1 con un ajuste de la diferencia.
--
--   supabase db query --linked -f supabase/tests/e2e_fixture_stock1.sql

do $$
declare
  v_comercio uuid;
  v_categoria uuid;
  v_producto uuid;
  v_dueno uuid;
begin
  select id into v_comercio from public.comercios where nombre = 'Kiosko Demo';
  select id into v_categoria from public.categorias
   where comercio_id = v_comercio order by orden limit 1;
  select id into v_dueno from public.perfiles
   where comercio_id = v_comercio and rol = 'dueno' limit 1;

  insert into public.productos
    (comercio_id, categoria_id, nombre, codigo_barras, precio, unidad_venta, stock_minimo)
  values
    (v_comercio, v_categoria, 'Producto e2e (stock 1)', '9990000000999', 100, 'unidad', 0)
  on conflict (comercio_id, codigo_barras) do nothing;

  select id into v_producto from public.productos
   where comercio_id = v_comercio and codigo_barras = '9990000000999';

  insert into public.movimientos_stock
    (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  select v_comercio, v_producto, 'ajuste', 1 - stock_actual, 'Fixture e2e', v_dueno
    from public.productos
   where id = v_producto and stock_actual <> 1;
end
$$;

select nombre, stock_actual from public.productos where codigo_barras = '9990000000999';
