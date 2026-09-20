-- Fase D: catálogo mínimo real para la demo comercial.
-- Categorías, medios de pago y rubros viven en datos (sección 3 de CLAUDE.md), nunca hardcodeados en código.

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  nombre text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  categoria_id uuid references public.categorias (id),
  nombre text not null,
  codigo_barras text not null,
  precio numeric(12, 2) not null check (precio >= 0),
  -- unidad_venta: campo de texto libre ('unidad' | 'pack'), sin lógica todavía.
  -- TODO(demo): sin catálogo de valores ni comportamiento distinto por unidad. Fase 3 lo formaliza.
  unidad_venta text not null default 'unidad',
  -- TODO(demo): stock_actual se actualiza con un UPDATE directo desde la server action de venta.
  -- En Fase 1 pasa a ser una caché mantenida por trigger a partir de movimientos_stock.
  stock_actual integer not null default 0 check (stock_actual >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  created_at timestamptz not null default now()
);

create index productos_comercio_id_idx on public.productos (comercio_id);
create unique index productos_comercio_codigo_barras_key
  on public.productos (comercio_id, codigo_barras);

create table public.medios_pago (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  nombre text not null,
  -- Punto de extensión (sección 7): tipo habilita integrar Mercado Pago / cuenta corriente después.
  tipo text not null check (tipo in ('efectivo', 'tarjeta', 'transferencia', 'qr', 'cuenta_corriente')),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.medios_pago enable row level security;

-- TODO(demo): políticas temporales sin login. Se eliminan en Fase 2 y se reemplazan
-- por la política base (comercio_id del perfil del usuario autenticado).
create policy "demo_anon_read_categorias"
  on public.categorias for select to anon using (true);

create policy "demo_anon_read_productos"
  on public.productos for select to anon using (true);

-- TODO(demo): el update anónimo de stock es la server action simple de la demo.
-- En Fase 1 se reemplaza por la función rpc registrar_venta (transaccional, sin acceso directo anon).
create policy "demo_anon_update_stock_productos"
  on public.productos for update to anon using (true) with check (true);

create policy "demo_anon_read_medios_pago"
  on public.medios_pago for select to anon using (true);
