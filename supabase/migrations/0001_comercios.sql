-- Fase 0: base multi-tenant. Cada tabla de negocio posterior referencia comercios(id).
create table public.comercios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

alter table public.comercios enable row level security;

-- Demo: política temporal de lectura anónima sin login. Resuelto en Fase 2: la elimina 0008 y
-- rige la política base (comercio_id del perfil del usuario).
create policy "demo_anon_read_comercios"
  on public.comercios
  for select
  to anon
  using (true);
