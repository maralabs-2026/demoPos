-- Fase 3: costo de productos y alta/edición atómica.
--
-- El costo no es una columna de productos: la RLS no filtra por columna y el cajero no debe verlo
-- de ninguna forma (sección 3 de CLAUDE.md, PR #5). Vive en productos_costos, una fila por producto,
-- a la que solo acceden dueño y encargado.
-- El snapshot del costo al momento de la venta (para la ganancia estimada de la Fase 6) no está
-- acá: se define aparte antes de cerrar la Fase 3.

create table public.productos_costos (
  producto_id uuid primary key,
  comercio_id uuid not null references public.comercios (id),
  costo numeric(12, 2) not null check (costo >= 0),
  updated_at timestamptz not null default now(),
  -- Mismo patrón que movimientos_stock: el costo y su producto son del mismo comercio.
  foreign key (producto_id, comercio_id)
    references public.productos (id, comercio_id) on delete cascade
);

create index productos_costos_comercio_id_idx on public.productos_costos (comercio_id);

alter table public.productos_costos enable row level security;

grant select, insert, update, delete on public.productos_costos to authenticated;

-- Cajero: ninguna política lo incluye, así que no lee ni escribe nada.
create policy productos_costos_select on public.productos_costos for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy productos_costos_insert on public.productos_costos for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy productos_costos_update on public.productos_costos for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  )
  with check (comercio_id = public.current_comercio_id());
create policy productos_costos_delete on public.productos_costos for delete to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

-- Alta (p_id null) o edición de un producto junto con su costo, en una sola transacción.
-- SECURITY INVOKER: la RLS de productos y de productos_costos sigue siendo la barrera.
-- p_costo null borra el costo cargado (producto sin costo conocido).
-- En una edición, p_precio_anterior y p_costo_anterior son los valores que el usuario vio al abrir
-- el formulario: si otro usuario los cambió mientras tanto (por ejemplo, una actualización masiva
-- de precios), se rechaza en vez de pisar el cambio. En un alta se ignoran.
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
  p_costo_anterior numeric default null
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
      (comercio_id, categoria_id, nombre, codigo_barras, precio, unidad_venta, stock_minimo)
    values
      (v_comercio_id, p_categoria_id, p_nombre, p_codigo_barras, p_precio, p_unidad_venta,
       p_stock_minimo)
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
           stock_minimo = p_stock_minimo
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

revoke execute on function public.guardar_producto(uuid, uuid, text, text, numeric, text, integer, numeric, numeric, numeric)
  from public, anon;
grant execute on function public.guardar_producto(uuid, uuid, text, text, numeric, text, integer, numeric, numeric, numeric)
  to authenticated;
