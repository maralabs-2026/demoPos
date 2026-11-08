-- Bloque 3.4a: proveedores y proveedor habitual de cada producto.
--
-- Solo dueño y encargado los ven y los administran: el cajero no accede a la tabla. Un proveedor no
-- se borra: se desactiva y deja de ofrecerse. Los nombres no se repiten por comercio, sin importar
-- mayúsculas. El teléfono va con código de país y solo dígitos, para armar el enlace de WhatsApp.
-- guardar_producto es la de 0032 con el proveedor habitual; la clave foránea compuesta impide
-- asignar un proveedor de otro comercio.

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  telefono text check (telefono is null or telefono ~ '^[0-9]{10,15}$'),
  nota text check (nota is null or char_length(nota) <= 300),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, comercio_id)
);

create unique index proveedores_comercio_nombre_key
  on public.proveedores (comercio_id, lower(btrim(nombre)));

alter table public.proveedores enable row level security;

grant select on public.proveedores to authenticated;
grant insert (comercio_id, nombre, telefono, nota)
  on public.proveedores to authenticated;
grant update (nombre, telefono, nota, activo, updated_at)
  on public.proveedores to authenticated;

create policy proveedores_select on public.proveedores for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy proveedores_insert on public.proveedores for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy proveedores_update on public.proveedores for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  )
  with check (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

alter table public.productos
  add column proveedor_id uuid,
  add constraint productos_proveedor_comercio_fkey
    foreign key (proveedor_id, comercio_id) references public.proveedores (id, comercio_id);

create index productos_proveedor_idx on public.productos (proveedor_id)
  where proveedor_id is not null;

grant insert (proveedor_id), update (proveedor_id) on public.productos to authenticated;

drop function public.guardar_producto(uuid, uuid, text, text, numeric, text, integer, numeric, numeric, numeric, boolean, boolean);

create function public.guardar_producto(
  p_id uuid,
  p_categoria_id uuid,
  p_nombre text,
  p_codigo_barras text,
  p_precio numeric,
  p_unidad_venta text,
  p_stock_minimo integer,
  p_costo numeric,
  p_precio_anterior numeric default null,
  p_costo_anterior numeric default null,
  p_controla_stock boolean default true,
  p_precio_libre boolean default false,
  p_proveedor_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_comercio_id uuid := public.current_comercio_id();
  v_id uuid;
  v_precio_actual numeric;
  v_costo_actual numeric;
begin
  -- La RLS de UPDATE filtra en silencio; el chequeo explícito da un error claro.
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede gestionar productos' using errcode = '42501';
  end if;

  -- categorias.comercio_id no forma parte de la FK de productos: se valida acá (la RLS de
  -- categorias ya oculta las de otros comercios).
  if p_categoria_id is not null and not exists (
    select 1 from public.categorias where id = p_categoria_id and comercio_id = v_comercio_id
  ) then
    raise exception 'La categoría no existe' using errcode = 'PV008';
  end if;

  if p_id is null then
    insert into public.productos
      (comercio_id, categoria_id, nombre, codigo_barras, precio, unidad_venta, stock_minimo,
       controla_stock, precio_libre, proveedor_id)
    values
      (v_comercio_id, p_categoria_id, p_nombre, p_codigo_barras, p_precio, p_unidad_venta,
       case when coalesce(p_controla_stock, true) then p_stock_minimo else 0 end,
       coalesce(p_controla_stock, true), coalesce(p_precio_libre, false), p_proveedor_id)
    returning id into v_id;
  else
    -- FOR UPDATE: nadie más cambia el producto entre esta lectura y el UPDATE.
    select p.precio, c.costo into v_precio_actual, v_costo_actual
      from public.productos p
      left join public.productos_costos c on c.producto_id = p.id
     where p.id = p_id and p.comercio_id = v_comercio_id
       for update of p;
    if not found then
      raise exception 'El producto no existe' using errcode = 'PV005';
    end if;
    if v_precio_actual is distinct from p_precio_anterior
       or v_costo_actual is distinct from p_costo_anterior then
      raise exception 'Otro usuario cambió el precio o el costo mientras editabas'
        using errcode = 'PV009';
    end if;

    update public.productos
       set categoria_id = p_categoria_id,
           nombre = p_nombre,
           codigo_barras = p_codigo_barras,
           precio = p_precio,
           unidad_venta = p_unidad_venta,
           stock_minimo = case when coalesce(p_controla_stock, true) then p_stock_minimo else 0 end,
           controla_stock = coalesce(p_controla_stock, true),
           precio_libre = coalesce(p_precio_libre, false),
           proveedor_id = p_proveedor_id
     where id = p_id and comercio_id = v_comercio_id
    returning id into v_id;
  end if;

  if p_costo is null then
    delete from public.productos_costos where producto_id = v_id;
  else
    insert into public.productos_costos (producto_id, comercio_id, costo)
    values (v_id, v_comercio_id, p_costo)
    on conflict (producto_id) do update
      set costo = excluded.costo, updated_at = now();
  end if;

  return v_id;
end;
$$;

revoke execute on function public.guardar_producto(uuid, uuid, text, text, numeric, text, integer, numeric, numeric, numeric, boolean, boolean, uuid)
  from public, anon;
grant execute on function public.guardar_producto(uuid, uuid, text, text, numeric, text, integer, numeric, numeric, numeric, boolean, boolean, uuid)
  to authenticated;
