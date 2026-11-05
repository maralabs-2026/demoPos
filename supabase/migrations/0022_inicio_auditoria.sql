-- Fase 6b: resumen del inicio, gastos en el reporte y auditoría de stock.
--
-- Efectivo en caja y conteo a ciegas: el dueño ve todas las cajas abiertas. El encargado ve las de
-- los demás, no la suya, porque le revelaría lo que tiene que contar.
--
-- Auditoría: la diferencia se calcula contra el stock al aplicar, con los productos bloqueados. Un
-- producto no contado no se toca.
--
--   42501 sin permiso    PV021 auditoría inválida

-- Igual que en 0021, más los gastos pagados del período. No dependen del cajero: son del comercio.
create or replace function public.reporte_ventas(
  p_desde date,
  p_hasta date,
  p_agrupar text default 'dia',
  p_usuario_id uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c_tz constant text := 'America/Argentina/Cordoba';
  v_comercio uuid := public.current_comercio_id();
  v_trunc text;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_resultado jsonb;
begin
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'No tenés permiso para ver reportes' using errcode = '42501';
  end if;
  v_trunc := case p_agrupar when 'dia' then 'day' when 'semana' then 'week' when 'mes' then 'month' end;
  if v_trunc is null or p_desde is null or p_hasta is null or p_desde > p_hasta
     or p_hasta - p_desde > 1100 then
    raise exception 'El período no es válido' using errcode = 'PV020';
  end if;

  v_inicio := p_desde::timestamp at time zone c_tz;
  v_fin := (p_hasta + 1)::timestamp at time zone c_tz;

  with ventas_periodo as (
    select v.id, v.total, v.descuento, v.estado, v.usuario_id,
           date_trunc(v_trunc, v.created_at at time zone c_tz)::date as periodo
      from public.ventas v
     where v.comercio_id = v_comercio
       and v.created_at >= v_inicio and v.created_at < v_fin
       and (p_usuario_id is null or v.usuario_id = p_usuario_id)
  ), completadas as (
    select * from ventas_periodo where estado = 'completada'
  ), items as (
    select i.producto_id, i.nombre, i.cantidad, c.periodo,
           i.subtotal * c.total / (c.total + c.descuento) as neto,
           k.costo
      from completadas c
      join public.venta_items i on i.venta_id = c.id
      left join public.venta_items_costos k on k.venta_item_id = i.id
  )
  select jsonb_build_object(
    'resumen', jsonb_build_object(
      'ventas', (select count(*) from completadas),
      'total', (select coalesce(sum(total), 0) from completadas),
      'descuentos', (select coalesce(sum(descuento), 0) from completadas),
      'anuladas', (select count(*) from ventas_periodo where estado = 'anulada'),
      'total_anulado', (select coalesce(sum(total), 0) from ventas_periodo where estado = 'anulada'),
      'ganancia', (select round(coalesce(sum(neto - costo * cantidad), 0), 2)
                     from items where costo is not null),
      'sin_costo', (select round(coalesce(sum(neto), 0), 2) from items where costo is null),
      'gastos_pagados', (select coalesce(sum(g.monto), 0) from public.gastos g
                          where g.comercio_id = v_comercio and g.estado = 'pagado'
                            and g.pagado_at >= v_inicio and g.pagado_at < v_fin)
    ),
    'periodos', coalesce((
      select jsonb_agg(p order by p.periodo)
        from (
          select c.periodo, count(*) as ventas, sum(c.total) as total,
                 (select round(coalesce(sum(i.neto - i.costo * i.cantidad), 0), 2)
                    from items i where i.periodo = c.periodo and i.costo is not null) as ganancia
            from completadas c
           group by c.periodo
        ) p
    ), '[]'::jsonb),
    'ranking', coalesce((
      select jsonb_agg(r order by r.cantidad desc, r.total desc)
        from (
          select i.producto_id, max(i.nombre) as nombre, sum(i.cantidad) as cantidad,
                 round(sum(i.neto), 2) as total
            from items i
           group by i.producto_id
           order by sum(i.cantidad) desc, sum(i.neto) desc
           limit 20
        ) r
    ), '[]'::jsonb),
    'por_cajero', coalesce((
      select jsonb_agg(u order by u.total desc)
        from (
          select c.usuario_id, p.nombre, count(*) as ventas, sum(c.total) as total
            from completadas c
            join public.perfiles p on p.id = c.usuario_id
           group by c.usuario_id, p.nombre
        ) u
    ), '[]'::jsonb),
    'por_medio', coalesce((
      select jsonb_agg(m order by m.total desc)
        from (
          select mp.nombre, sum(vp.monto) as total
            from completadas c
            join public.venta_pagos vp on vp.venta_id = c.id
            join public.medios_pago mp on mp.id = vp.medio_pago_id
           group by mp.nombre
        ) m
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end
$$;

create function public.inicio_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_tz constant text := 'America/Argentina/Cordoba';
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_rol public.rol_usuario := public.current_rol();
  v_hoy date := (now() at time zone c_tz)::date;
  v_inicio_hoy timestamptz := v_hoy::timestamp at time zone c_tz;
  v_resultado jsonb;
begin
  if v_rol is null or v_rol not in ('dueno', 'encargado') then
    raise exception 'No tenés permiso para ver el inicio' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'hoy', (
      select jsonb_build_object('ventas', count(*), 'total', coalesce(sum(v.total), 0))
        from public.ventas v
       where v.comercio_id = v_comercio and v.estado = 'completada'
         and v.created_at >= v_inicio_hoy
    ),
    'cajas', coalesce((
      select jsonb_agg(c order by c.abierta_at)
        from (
          select k.id as caja_id, k.abierta_at, p.nombre as titular,
                 (select coalesce(sum(e.esperado), 0)
                    from public.caja_esperado_por_medio(k.id) e
                   where e.tipo = 'efectivo') as efectivo
            from public.cajas k
            join public.perfiles p on p.id = k.usuario_id
           where k.comercio_id = v_comercio and k.estado = 'abierta'
             and (v_rol = 'dueno' or k.usuario_id <> v_uid)
        ) c
    ), '[]'::jsonb),
    'caja_propia_oculta', (
      v_rol <> 'dueno' and exists (
        select 1 from public.cajas k
         where k.comercio_id = v_comercio and k.estado = 'abierta' and k.usuario_id = v_uid
      )
    ),
    'mes', public.reporte_ventas(date_trunc('month', v_hoy)::date, v_hoy, 'mes') -> 'resumen',
    'reposicion', (
      select count(*) from public.productos x
       where x.comercio_id = v_comercio and x.stock_minimo > 0 and x.stock_actual < x.stock_minimo
    ),
    'cajas_con_diferencia', coalesce((
      select jsonb_agg(d order by d.cerrada_at desc)
        from (
          select k.id as caja_id, k.cerrada_at, p.nombre as titular, sum(l.diferencia) as diferencia
            from public.cajas k
            join public.caja_cierres l on l.caja_id = k.id
            join public.perfiles p on p.id = k.usuario_id
           where k.comercio_id = v_comercio and k.estado = 'cerrada'
             and k.cerrada_at >= now() - interval '7 days'
           group by k.id, k.cerrada_at, p.nombre
          having bool_or(l.diferencia <> 0)
           order by k.cerrada_at desc
           limit 5
        ) d
    ), '[]'::jsonb),
    'gastos', coalesce((
      select jsonb_agg(g order by g.vencimiento)
        from (
          select x.id, x.descripcion, x.monto, x.vencimiento
            from public.gastos x
           where x.comercio_id = v_comercio and x.estado = 'por_pagar'
             and x.vencimiento <= v_hoy + 7
           order by x.vencimiento
           limit 5
        ) g
    ), '[]'::jsonb),
    'actividad', coalesce((
      select jsonb_agg(a order by a.fecha desc)
        from (
          select * from (
            select 'anulacion' as tipo, v.anulada_at as fecha, v.total as monto,
                   v.motivo_anulacion as detalle, p.nombre as usuario, v.id as ref
              from public.ventas v
              join public.perfiles p on p.id = v.anulada_por
             where v.comercio_id = v_comercio and v.estado = 'anulada'
            union all
            select 'cierre', k.cerrada_at, null, null, p.nombre, k.id
              from public.cajas k
              join public.perfiles p on p.id = coalesce(k.cerrada_por, k.usuario_id)
             where k.comercio_id = v_comercio and k.estado = 'cerrada'
            union all
            select m.tipo, m.created_at, m.monto, m.motivo, p.nombre, m.caja_id
              from public.caja_movimientos m
              join public.perfiles p on p.id = m.usuario_id
             where m.comercio_id = v_comercio
            union all
            select 'gasto', g.pagado_at, g.monto, g.descripcion, p.nombre, g.id
              from public.gastos g
              join public.perfiles p on p.id = g.pagado_por
             where g.comercio_id = v_comercio and g.estado = 'pagado' and g.caja_id is null
          ) todo
          where todo.fecha is not null
          order by todo.fecha desc
          limit 10
        ) a
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end
$$;

revoke execute on function public.inicio_resumen() from public, anon;
grant execute on function public.inicio_resumen() to authenticated;

-- p_categoria_id null: los productos sin categoría. p_conteos: [{ "producto_id": uuid, "contado": n }].
-- Devuelve cada producto contado con el stock que tenía y su diferencia.
create function public.aplicar_auditoria_stock(p_categoria_id uuid, p_conteos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_rol public.rol_usuario := public.current_rol();
  v_motivo text := 'Auditoría de stock';
  v_nombre text;
  v_linea record;
  v_lineas jsonb := '[]'::jsonb;
begin
  if v_rol is null or v_rol not in ('dueno', 'encargado') then
    raise exception 'No tenés permiso para auditar el stock' using errcode = '42501';
  end if;
  if jsonb_typeof(p_conteos) is distinct from 'array' or jsonb_array_length(p_conteos) = 0 then
    raise exception 'Falta el conteo' using errcode = 'PV021';
  end if;

  if p_categoria_id is not null then
    select c.nombre into v_nombre from public.categorias c
     where c.id = p_categoria_id and c.comercio_id = v_comercio;
    if v_nombre is null then
      raise exception 'La categoría no existe' using errcode = 'PV021';
    end if;
    v_motivo := left(v_motivo || ': ' || v_nombre, 200);
  end if;

  begin
    if exists (
      select 1 from jsonb_to_recordset(p_conteos) as x (producto_id uuid, contado integer)
       where x.producto_id is null or x.contado is null or x.contado < 0
    ) or exists (
      select 1 from jsonb_to_recordset(p_conteos) as x (producto_id uuid, contado integer)
       group by x.producto_id having count(*) > 1
    ) or exists (
      select 1 from jsonb_to_recordset(p_conteos) as x (producto_id uuid, contado integer)
       where not exists (
         select 1 from public.productos p
          where p.id = x.producto_id and p.comercio_id = v_comercio
            and p.categoria_id is not distinct from p_categoria_id
       )
    ) then
      raise exception 'El conteo no es válido' using errcode = 'PV021';
    end if;
  exception when invalid_text_representation or data_exception then
    -- Un valor que no se puede leer como uuid o entero.
    raise exception 'El conteo no es válido' using errcode = 'PV021';
  end;

  -- Bloqueo en orden fijo: una venta en curso termina antes, o espera y descuenta del stock nuevo.
  for v_linea in
    select p.id, p.nombre, p.stock_actual, x.contado
      from jsonb_to_recordset(p_conteos) as x (producto_id uuid, contado integer)
      join public.productos p on p.id = x.producto_id
     order by p.id
       for update of p
  loop
    if v_linea.contado <> v_linea.stock_actual then
      insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
      values (v_comercio, v_linea.id, 'ajuste', v_linea.contado - v_linea.stock_actual, v_motivo, v_uid);
    end if;
    v_lineas := v_lineas || jsonb_build_object(
      'producto_id', v_linea.id,
      'nombre', v_linea.nombre,
      'sistema', v_linea.stock_actual,
      'contado', v_linea.contado,
      'diferencia', v_linea.contado - v_linea.stock_actual
    );
  end loop;

  return jsonb_build_object('motivo', v_motivo, 'lineas', v_lineas);
end
$$;

revoke execute on function public.aplicar_auditoria_stock(uuid, jsonb) from public, anon;
grant execute on function public.aplicar_auditoria_stock(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
