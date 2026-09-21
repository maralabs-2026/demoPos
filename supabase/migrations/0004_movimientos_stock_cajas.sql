-- Fase 1: el stock pasa a ser la suma de movimientos; productos.stock_actual es una caché
-- mantenida por trigger. También se crea `cajas` (la usa registrar_venta y la Fase 5).

alter table public.productos
  add constraint productos_id_comercio_key unique (id, comercio_id);
alter table public.medios_pago
  add constraint medios_pago_id_comercio_key unique (id, comercio_id);

create table public.cajas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  usuario_id uuid not null,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  monto_inicial numeric(12, 2) not null default 0 check (monto_inicial >= 0),
  abierta_at timestamptz not null default now(),
  cerrada_at timestamptz,
  unique (id, comercio_id),
  foreign key (usuario_id, comercio_id) references public.perfiles (id, comercio_id),
  check ((estado = 'cerrada') = (cerrada_at is not null))
);

-- Un usuario tiene como máximo una caja abierta.
create unique index cajas_una_abierta_por_usuario_idx
  on public.cajas (usuario_id) where estado = 'abierta';
create index cajas_comercio_id_idx on public.cajas (comercio_id);

create table public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  producto_id uuid not null,
  tipo text not null check (tipo in ('ingreso', 'venta', 'ajuste')),
  -- Con signo: positivo suma stock, negativo lo descuenta.
  cantidad integer not null check (cantidad <> 0),
  motivo text,
  venta_id uuid, -- la clave foránea a ventas se agrega en 0005
  usuario_id uuid, -- null solo para movimientos generados por migraciones
  created_at timestamptz not null default now(),
  foreign key (producto_id, comercio_id) references public.productos (id, comercio_id),
  foreign key (usuario_id, comercio_id) references public.perfiles (id, comercio_id),
  check (tipo <> 'venta' or venta_id is not null),
  check (tipo <> 'ajuste' or motivo is not null)
);

create index movimientos_stock_producto_idx
  on public.movimientos_stock (producto_id, created_at desc);
create index movimientos_stock_comercio_idx on public.movimientos_stock (comercio_id);

alter table public.cajas enable row level security;
alter table public.movimientos_stock enable row level security;

-- Suma incremental (no recalcula): bajo concurrencia toma el lock de la fila del producto
-- y trabaja sobre la última versión, así que dos ventas simultáneas nunca pisan el stock.
-- Si el resultado fuera negativo, el CHECK de productos.stock_actual aborta la transacción.
create function public.aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.productos
     set stock_actual = stock_actual + new.cantidad
   where id = new.producto_id
     and comercio_id = new.comercio_id;
  return new;
end
$$;

create trigger movimientos_stock_aplicar
  after insert on public.movimientos_stock
  for each row execute function public.aplicar_movimiento_stock();

-- Los movimientos son un registro contable: no se editan ni se borran.
create function public.movimientos_stock_inmutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'movimientos_stock es de solo agregado (no se permite % )', tg_op
    using errcode = 'PV006';
end
$$;

create trigger movimientos_stock_sin_update_delete
  before update or delete on public.movimientos_stock
  for each row execute function public.movimientos_stock_inmutable();

-- Respaldo del stock que ya existía (la demo escribía stock_actual directo): se registra como
-- movimiento inicial. Se pone la caché en 0 antes para que el trigger la reconstruya sin duplicar.
create temp table _stock_previo as
  select id, comercio_id, stock_actual from public.productos where stock_actual > 0;

update public.productos set stock_actual = 0 where stock_actual > 0;

insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo)
select comercio_id, id, 'ajuste', stock_actual, 'Stock inicial (migración)' from _stock_previo;

drop table _stock_previo;
