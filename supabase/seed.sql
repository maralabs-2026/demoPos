insert into public.comercios (nombre) values ('Kiosko Demo');

-- Categorías (Fase D): 7 rubros típicos de kiosco. Viven en datos, no en código.
insert into public.categorias (comercio_id, nombre, orden)
select co.id, c.nombre, c.orden
from public.comercios co, (values
  ('Golosinas y chocolates', 1),
  ('Galletitas y snacks', 2),
  ('Bebidas', 3),
  ('Cigarrillos y encendedores', 4),
  ('Lácteos y panificados', 5),
  ('Almacén', 6),
  ('Higiene y limpieza', 7)
) as c(nombre, orden)
where co.nombre = 'Kiosko Demo';

-- Medios de pago típicos de kiosco. 'tipo' habilita el punto de extensión de Mercado Pago (sección 7).
insert into public.medios_pago (comercio_id, nombre, tipo, orden)
select co.id, m.nombre, m.tipo, m.orden
from public.comercios co, (values
  ('Efectivo', 'efectivo', 1),
  ('Débito', 'tarjeta', 2),
  ('Crédito', 'tarjeta', 3),
  ('Transferencia', 'transferencia', 4),
  ('QR (Mercado Pago)', 'qr', 5)
) as m(nombre, tipo, orden)
where co.nombre = 'Kiosko Demo';

-- 40 productos reales de kiosco. 3 por debajo de stock_minimo, 2 en stock cero (para las alertas).
insert into public.productos (
  comercio_id, categoria_id, nombre, codigo_barras, precio, unidad_venta, stock_actual, stock_minimo
)
select co.id, cat.id, p.nombre, p.codigo_barras, p.precio, p.unidad_venta, p.stock_actual, p.stock_minimo
from public.comercios co
join (values
  -- Golosinas y chocolates (8)
  ('Golosinas y chocolates', 'Cofler Bon o Bon',             '7790010000017', 1500.00, 'unidad', 40, 10),
  ('Golosinas y chocolates', 'Georgalos Sapito',              '7790010000024', 1200.00, 'unidad', 50, 10),
  ('Golosinas y chocolates', 'Arcor Butter Toffees',          '7790010000031', 1400.00, 'unidad', 35, 10),
  ('Golosinas y chocolates', 'Milka Chocolate 100g',          '7790010000048', 3200.00, 'unidad', 25, 8),
  ('Golosinas y chocolates', 'Águila Chocolate 100g',         '7790010000055', 2800.00, 'unidad', 30, 8),
  ('Golosinas y chocolates', 'Felfort Shot Six Pack',         '7790010000062', 2200.00, 'unidad', 20, 6),
  ('Golosinas y chocolates', 'Felfort Rhodesia',              '7790010000079', 1300.00, 'unidad', 45, 10),
  ('Golosinas y chocolates', 'Mantecol Clásico 100g',         '7790010000086', 2600.00, 'unidad', 3,  10), -- bajo mínimo
  -- Galletitas y snacks (6)
  ('Galletitas y snacks', 'Oreo Original 170g',               '7790010000093', 2900.00, 'unidad', 28, 8),
  ('Galletitas y snacks', 'Pepitos Chocolate 220g',           '7790010000109', 3100.00, 'unidad', 22, 8),
  ('Galletitas y snacks', 'Traviata Chocolate 200g',          '7790010000116', 2700.00, 'unidad', 4,  8), -- bajo mínimo
  ('Galletitas y snacks', 'Papas Lays Clásicas 140g',         '7790010000123', 3400.00, 'unidad', 18, 6),
  ('Galletitas y snacks', 'Doritos Nachos 145g',              '7790010000130', 3600.00, 'unidad', 16, 6),
  ('Galletitas y snacks', 'Palitos Salvado Bagley 200g',      '7790010000147', 2400.00, 'unidad', 24, 6),
  -- Bebidas (8)
  ('Bebidas', 'Coca-Cola 500ml',                              '7790010000154', 2500.00, 'unidad', 60, 15),
  ('Bebidas', 'Sprite 500ml',                                 '7790010000161', 2400.00, 'unidad', 40, 15),
  ('Bebidas', 'Pepsi 500ml',                                  '7790010000178', 2300.00, 'unidad', 30, 15),
  ('Bebidas', 'Agua Villavicencio 500ml',                     '7790010000185', 1500.00, 'unidad', 50, 15),
  ('Bebidas', 'Cepita Jugo Naranja 500ml',                    '7790010000192', 2600.00, 'unidad', 2,  12), -- bajo mínimo
  ('Bebidas', 'Speed Energizante 473ml',                      '7790010000208', 3200.00, 'unidad', 20, 8),
  ('Bebidas', 'Quilmes Cerveza Lata 473ml',                   '7790010000215', 2900.00, 'unidad', 36, 12),
  ('Bebidas', 'Brahma Cerveza Lata 473ml',                    '7790010000222', 2800.00, 'unidad', 0,  12), -- stock cero
  -- Cigarrillos y encendedores (5)
  ('Cigarrillos y encendedores', 'Marlboro Box 20',           '7790010000239', 8500.00, 'unidad', 25, 10),
  ('Cigarrillos y encendedores', 'Philip Morris Box 20',      '7790010000246', 8300.00, 'unidad', 25, 10),
  ('Cigarrillos y encendedores', 'Camel Box 20',              '7790010000253', 8400.00, 'unidad', 0,  10), -- stock cero
  ('Cigarrillos y encendedores', 'Lucky Strike Box 20',       '7790010000260', 8200.00, 'unidad', 15, 10),
  ('Cigarrillos y encendedores', 'Encendedor Bic',            '7790010000277', 900.00,  'unidad', 60, 20),
  -- Lácteos y panificados (4)
  ('Lácteos y panificados', 'Leche La Serenísima Entera 1L',  '7790010000284', 2100.00, 'unidad', 30, 10),
  ('Lácteos y panificados', 'Yogur Sancor Bebible Frutilla 900ml', '7790010000291', 2300.00, 'unidad', 20, 8),
  ('Lácteos y panificados', 'Pan Lactal Bimbo Grande',        '7790010000307', 2900.00, 'unidad', 18, 8),
  ('Lácteos y panificados', 'Facturas Surtidas x6',           '7790010000314', 3500.00, 'pack',   12, 5),
  -- Almacén (5)
  ('Almacén', 'Arroz Gallo Oro 1kg',                          '7790010000321', 3000.00, 'unidad', 25, 10),
  ('Almacén', 'Fideos Matarazzo Mostachol 500g',              '7790010000338', 2200.00, 'unidad', 30, 10),
  ('Almacén', 'Yerba Mate Playadito 1kg',                     '7790010000345', 9000.00, 'unidad', 22, 8),
  ('Almacén', 'Azúcar Ledesma 1kg',                           '7790010000352', 2400.00, 'unidad', 28, 10),
  ('Almacén', 'Aceite Natura 900ml',                          '7790010000369', 4500.00, 'unidad', 15, 8),
  -- Higiene y limpieza (4)
  ('Higiene y limpieza', 'Papel Higiénico Elite x4',          '7790010000376', 4000.00, 'pack',   20, 8),
  ('Higiene y limpieza', 'Jabón Dove Barra 90g',               '7790010000383', 2200.00, 'unidad', 25, 8),
  ('Higiene y limpieza', 'Pañales Pampers Confort M x20',     '7790010000390', 6000.00, 'pack',   12, 6),
  ('Higiene y limpieza', 'Lavandina Ayudín 1L',               '7790010000406', 2000.00, 'unidad', 30, 10)
) as p(categoria_nombre, nombre, codigo_barras, precio, unidad_venta, stock_actual, stock_minimo)
  on true
join public.categorias cat on cat.comercio_id = co.id and cat.nombre = p.categoria_nombre
where co.nombre = 'Kiosko Demo';

-- Configuración por comercio (Fase 1): moneda y datos del ticket viven en datos, no en código.
insert into public.configuracion (comercio_id, clave, valor)
select co.id, c.clave, c.valor
from public.comercios co, (values
  ('moneda', '{"codigo": "ARS", "locale": "es-AR"}'::jsonb),
  ('ticket', '{"titulo": "Kiosko Demo"}'::jsonb)
) as c(clave, valor)
where co.nombre = 'Kiosko Demo';

-- El stock es la suma de movimientos: el stock inicial de los productos se registra como
-- movimiento. Se pone la caché en 0 antes para que el trigger la reconstruya sin duplicar.
create temp table _stock_inicial as
  select id, comercio_id, stock_actual from public.productos where stock_actual > 0;

update public.productos set stock_actual = 0 where stock_actual > 0;

insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo)
select comercio_id, id, 'ajuste', stock_actual, 'Stock inicial' from _stock_inicial;

drop table _stock_inicial;
