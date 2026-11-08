-- Bloque 3.6: análisis del período. Margen por categoría, horarios pico y productos sin movimiento.
--
-- Solo lectura, con la RLS de quien consulta, igual que reporte_ventas (0026): el neto de cada ítem
-- reparte el descuento sobre el total, las anuladas no cuentan y el período respeta la hora de corte.
--   - El margen usa los snapshots de la venta. La categoría es la actual del producto.
--   - Lo vendido sin costo cargado va aparte, para no inflar el margen.
--   - La hora es la real del reloj; el día de la semana es el día comercial, así un turno de 22 a 6
--     queda en un solo día.
--   - Sin movimiento: productos con stock (no servicios) sin ventas en el período.

create function public.reporte_analisis(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c_tz constant text := 'America/Argentina/Cordoba';
  v_comercio uuid := public.current_comercio_id();
  v_corte interval := public.corte_dia_comercial();
  v_inicio timestamptz;
  v_fin timestamptz;
  v_resultado jsonb;
begin
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'No tenés permiso para ver reportes' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 1100 then
    raise exception 'El período no es válido' using errcode = 'PV020';
  end if;

  v_inicio := (p_desde::timestamp + v_corte) at time zone c_tz;
  v_fin := ((p_hasta + 1)::timestamp + v_corte) at time zone c_tz;

  with completadas as (
    select v.id, v.total, v.descuento, v.created_at at time zone c_tz as local
      from public.ventas v
     where v.comercio_id = v_comercio and v.estado = 'completada'
       and v.created_at >= v_inicio and v.created_at < v_fin
  ), items as (
    select i.producto_id, i.cantidad,
           i.subtotal * c.total / (c.total + c.descuento) as neto,
           k.costo
      from completadas c
      join public.venta_items i on i.venta_id = c.id
      left join public.venta_items_costos k on k.venta_item_id = i.id
  ), por_categoria as (
    select coalesce(cat.nombre, 'Sin categoría') as categoria,
           round(sum(it.neto), 2) as total,
           round(coalesce(sum(it.neto - it.costo * it.cantidad) filter (where it.costo is not null), 0), 2) as ganancia,
           round(coalesce(sum(it.neto) filter (where it.costo is not null), 0), 2) as total_con_costo,
           round(coalesce(sum(it.neto) filter (where it.costo is null), 0), 2) as sin_costo
      from items it
      join public.productos p on p.id = it.producto_id
      left join public.categorias cat on cat.id = p.categoria_id
     group by 1
  ), sin_movimiento as (
    select p.id as producto_id, p.nombre, p.stock_actual, p.unidad_venta,
           case when pc.costo is null then null
                else round(p.stock_actual * pc.costo, 2) end as inmovilizado,
           (select max(v.created_at)
              from public.venta_items i
              join public.ventas v on v.id = i.venta_id
             where i.producto_id = p.id and v.estado = 'completada') as ultima_venta
      from public.productos p
      left join public.productos_costos pc on pc.producto_id = p.id
     where p.comercio_id = v_comercio and p.controla_stock and p.stock_actual > 0
       and not exists (select 1 from items it where it.producto_id = p.id)
  )
  select jsonb_build_object(
    'categorias', coalesce((
      select jsonb_agg(c order by c.ganancia desc, c.total desc) from por_categoria c
    ), '[]'::jsonb),
    'por_hora', coalesce((
      select jsonb_agg(h order by h.hora)
        from (
          select extract(hour from c.local)::int as hora, count(*) as ventas, sum(c.total) as total
            from completadas c group by 1
        ) h
    ), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(d order by d.dia)
        from (
          select extract(dow from c.local - v_corte)::int as dia, count(*) as ventas, sum(c.total) as total
            from completadas c group by 1
        ) d
    ), '[]'::jsonb),
    'sin_movimiento', coalesce((
      select jsonb_agg(s order by s.inmovilizado desc nulls last, s.nombre)
        from (
          select * from sin_movimiento
           order by inmovilizado desc nulls last, nombre
           limit 100
        ) s
    ), '[]'::jsonb),
    'sin_movimiento_total', (select count(*) from sin_movimiento)
  ) into v_resultado;

  return v_resultado;
end
$$;

revoke execute on function public.reporte_analisis(date, date) from public, anon;
grant execute on function public.reporte_analisis(date, date) to authenticated;
