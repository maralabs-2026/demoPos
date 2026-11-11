-- Inicio: el efectivo de cada caja abierta viene con su desglose (fondo inicial, ventas en
-- efectivo, ingresos y retiros), para que se entienda de dónde sale el total. Quién ve qué caja
-- no cambia. El resto es copia de 0042.
create or replace function public.inicio_resumen()
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
  v_corte interval := public.corte_dia_comercial();
  -- "Hoy" es el día comercial: antes de la hora de corte, todavía es el día anterior.
  v_hoy date := ((now() at time zone c_tz) - v_corte)::date;
  v_inicio_hoy timestamptz := (v_hoy::timestamp + v_corte) at time zone c_tz;
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
                 k.usuario_id = v_uid as propia,
                 (select coalesce(sum(e.esperado), 0)
                    from public.caja_esperado_por_medio(k.id) e
                   where e.tipo = 'efectivo') as efectivo,
                 -- Desglose: efectivo = fondo + ventas_efectivo + ingresos − retiros, igual que
                 -- caja_esperado_por_medio (los gastos pagados con la caja son retiros).
                 k.monto_inicial as fondo,
                 (select coalesce(sum(t.total), 0)
                    from public.caja_totales t
                    join public.medios_pago m on m.id = t.medio_pago_id
                   where t.caja_id = k.id and m.tipo = 'efectivo') as ventas_efectivo,
                 (select coalesce(sum(cm.monto), 0)
                    from public.caja_movimientos cm
                   where cm.caja_id = k.id and cm.tipo = 'ingreso') as ingresos,
                 (select coalesce(sum(cm.monto), 0)
                    from public.caja_movimientos cm
                   where cm.caja_id = k.id and cm.tipo = 'retiro') as retiros
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
       where x.comercio_id = v_comercio and x.activo
         and x.stock_minimo > 0 and x.stock_actual < x.stock_minimo
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
                   v.motivo_anulacion as detalle, p.nombre as usuario, v.id as ref,
                   null::text as autorizo
              from public.ventas v
              join public.perfiles p on p.id = v.anulada_por
             where v.comercio_id = v_comercio and v.estado = 'anulada'
            union all
            select 'cierre', k.cerrada_at, null, null, p.nombre, k.id, null
              from public.cajas k
              join public.perfiles p on p.id = coalesce(k.cerrada_por, k.usuario_id)
             where k.comercio_id = v_comercio and k.estado = 'cerrada'
            union all
            -- Un ajuste se marca como tal; si lo cargó otro con código, va quién lo autorizó.
            select case when m.es_ajuste then 'ajuste_' || m.tipo else m.tipo end,
                   m.created_at, m.monto, m.motivo, p.nombre, m.caja_id, au.nombre
              from public.caja_movimientos m
              join public.perfiles p on p.id = m.usuario_id
              left join public.perfiles au on au.id = m.autorizado_por
             where m.comercio_id = v_comercio
            union all
            select 'gasto', g.pagado_at, g.monto, g.descripcion, p.nombre, g.id, null
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

notify pgrst, 'reload schema';
