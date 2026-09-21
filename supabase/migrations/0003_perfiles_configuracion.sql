-- Fase 1: perfiles (usuario -> comercio + rol), configuración por comercio y helpers de tenant.
-- Las políticas RLS de estas tablas se definen en 0006; RLS queda activado desde la creación
-- (sin políticas = nadie accede) para que ninguna tabla exista nunca sin protección.

create type public.rol_usuario as enum ('dueno', 'encargado', 'cajero');

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  comercio_id uuid not null references public.comercios (id),
  rol public.rol_usuario not null,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  -- Permite claves foráneas compuestas (id, comercio_id) desde otras tablas:
  -- la base garantiza que una fila nunca referencia a otro comercio.
  unique (id, comercio_id)
);

create index perfiles_comercio_id_idx on public.perfiles (comercio_id);

-- Configuración clave/valor por comercio: datos del ticket, moneda, formato de precios.
create table public.configuracion (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  clave text not null,
  valor jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comercio_id, clave)
);

alter table public.perfiles enable row level security;
alter table public.configuracion enable row level security;

-- Resuelven el comercio y el rol del usuario autenticado. SECURITY DEFINER para leer
-- `perfiles` sin disparar su propia RLS (evita recursión en las políticas).
create function public.current_comercio_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select comercio_id from public.perfiles where id = auth.uid() and activo
$$;

create function public.current_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

revoke execute on function public.current_comercio_id() from public, anon;
revoke execute on function public.current_rol() from public, anon;
grant execute on function public.current_comercio_id() to authenticated;
grant execute on function public.current_rol() to authenticated;
