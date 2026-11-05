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
  -- Demo: sin catálogo de valores. Fase 3 lo deja editable como texto en el ABM; vender por pack
  -- con otra lógica queda fuera de esta versión.
  unidad_venta text not null default 'unidad',
  -- Demo: stock_actual se actualizaba con un UPDATE directo desde la server action de venta.
  -- Resuelto en Fase 1 (0004): es una caché mantenida por trigger a partir de movimientos_stock.
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

-- Demo: políticas temporales sin login. Resuelto en Fase 2: las elimina 0008 y rige la política
-- base (comercio_id del perfil del usuario autenticado).
create policy "demo_anon_read_categorias"
  on public.categorias for select to anon using (true);

create policy "demo_anon_read_productos"
  on public.productos for select to anon using (true);

-- Demo: el update anónimo de stock era la server action simple de la demo. Resuelto en Fase 1:
-- 0006 elimina la política y registrar_venta (0007) cierra la venta en una transacción.
create policy "demo_anon_update_stock_productos"
  on public.productos for update to anon using (true) with check (true);

create policy "demo_anon_read_medios_pago"
  on public.medios_pago for select to anon using (true);
