-- Fase 1: cabecera de venta, ítems y pagos. Solo se escriben desde la función registrar_venta
-- (0007); el resto de los roles únicamente lee (ver 0006).

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  caja_id uuid not null,
  usuario_id uuid not null,
  total numeric(12, 2) not null check (total > 0),
  estado text not null default 'completada' check (estado in ('completada', 'anulada')),
  -- Puntos de extensión (sección 7 de CLAUDE.md), sin lógica todavía.
  comprobante_fiscal_id uuid,
  cliente_id uuid,
  created_at timestamptz not null default now(),
  unique (id, comercio_id),
  foreign key (caja_id, comercio_id) references public.cajas (id, comercio_id),
  foreign key (usuario_id, comercio_id) references public.perfiles (id, comercio_id)
);

create index ventas_comercio_created_idx on public.ventas (comercio_id, created_at desc);
create index ventas_caja_idx on public.ventas (caja_id);

-- nombre y precio_unitario son snapshot al momento de vender: cambiar el producto después
-- no altera ventas pasadas.
create table public.venta_items (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  venta_id uuid not null,
  producto_id uuid not null,
  nombre text not null,
  precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
  cantidad integer not null check (cantidad > 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  foreign key (venta_id, comercio_id) references public.ventas (id, comercio_id),
  foreign key (producto_id, comercio_id) references public.productos (id, comercio_id)
);

create index venta_items_venta_idx on public.venta_items (venta_id);
create index venta_items_producto_idx on public.venta_items (producto_id);

create table public.venta_pagos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  venta_id uuid not null,
  medio_pago_id uuid not null,
  monto numeric(12, 2) not null check (monto > 0),
  recibido numeric(12, 2) check (recibido is null or recibido >= monto),
  vuelto numeric(12, 2) not null default 0 check (vuelto >= 0),
  -- Punto de extensión para Mercado Pago (sección 7).
  referencia_externa text,
  foreign key (venta_id, comercio_id) references public.ventas (id, comercio_id),
  foreign key (medio_pago_id, comercio_id) references public.medios_pago (id, comercio_id)
);

create index venta_pagos_venta_idx on public.venta_pagos (venta_id);

alter table public.movimientos_stock
  add constraint movimientos_stock_venta_fkey
  foreign key (venta_id, comercio_id) references public.ventas (id, comercio_id);

alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
alter table public.venta_pagos enable row level security;

-- Cuánto entró a cada caja por medio de pago (base del arqueo de la Fase 5).
-- security_invoker: respeta la RLS de quien consulta.
create view public.caja_totales with (security_invoker = true) as
select v.comercio_id, v.caja_id, p.medio_pago_id, sum(p.monto) as total
from public.ventas v
join public.venta_pagos p on p.venta_id = v.id and p.comercio_id = v.comercio_id
where v.estado = 'completada'
group by v.comercio_id, v.caja_id, p.medio_pago_id;
