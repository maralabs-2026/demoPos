-- Snapshot del costo al momento de la venta, para la ganancia estimada de la Fase 6.
--
-- Fuera de venta_items: esa tabla la lee el cajero y la RLS no filtra por columna (sección 3 de
-- CLAUDE.md). Costo por unidad. Sin fila = el producto no tenía costo cargado; no es $ 0, que
-- inflaría la ganancia. Las ventas anteriores a esta migración quedan sin fila: su costo real ya
-- no se conoce.

alter table public.venta_items
  add constraint venta_items_id_comercio_key unique (id, comercio_id);

create table public.venta_items_costos (
  venta_item_id uuid primary key,
  comercio_id uuid not null references public.comercios (id),
  costo numeric(12, 2) not null check (costo >= 0),
  -- Mismo patrón que productos_costos: el costo y su ítem son del mismo comercio.
  foreign key (venta_item_id, comercio_id) references public.venta_items (id, comercio_id)
);

create index venta_items_costos_comercio_id_idx on public.venta_items_costos (comercio_id);

alter table public.venta_items_costos enable row level security;

-- Solo lectura: nadie escribe directo, así que un costo guardado no se puede editar. Cajero:
-- ninguna política lo incluye.
grant select on public.venta_items_costos to authenticated;

create policy venta_items_costos_select on public.venta_items_costos for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

-- Corre en la transacción de registrar_venta: si falla, la venta entera se revierte. Esa función ya
-- bloqueó el producto, y guardar_producto también lo bloquea antes de cambiar el costo.
-- SECURITY DEFINER: quien vende puede ser un cajero, que no lee productos_costos.
create function public.venta_items_guardar_costo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.venta_items_costos (venta_item_id, comercio_id, costo)
  select new.id, new.comercio_id, c.costo
    from public.productos_costos c
   where c.producto_id = new.producto_id
     and c.comercio_id = new.comercio_id;
  return new;
end
$$;

create trigger venta_items_guardar_costo
  after insert on public.venta_items
  for each row execute function public.venta_items_guardar_costo();
