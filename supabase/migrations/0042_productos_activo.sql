-- Productos desactivados. Un producto con ventas o movimientos no se borra (sus FK lo protegen):
-- se desactiva. Deja de ofrecerse al vender, en la reposición y en la auditoría, pero sigue en el
-- historial y los reportes, y se puede reactivar. Conserva su código de barras: al reactivarlo
-- vuelve tal cual. Si el código se necesita para otro producto, primero se le borra al inactivo.
--
-- Vender un inactivo:
--   - registrar_venta lo rechaza (PV033) sin dejar rastro.
--   - registrar_venta_sin_conexion lo acepta, porque la mercadería ya se entregó, y marca la venta
--     con el aviso 'inactivo' para que la revise el dueño (igual que 'precio' y 'stock', 0028).
-- Lo controla un trigger en venta_items: cubre las dos funciones sin copiarlas. Corre después de
-- que la función bloqueó el producto (for update), así que no compite con quien lo desactiva.

alter table public.productos
  add column activo boolean not null default true;

-- productos se escribe por columna (0006, 0031, 0032). La política productos_update ya limita la
-- escritura a dueño y encargado.
grant update (activo) on public.productos to authenticated;

alter table public.ventas
  drop constraint ventas_avisos_sin_conexion_check,
  add constraint ventas_avisos_sin_conexion_check
    check (avisos_sin_conexion <@ array['precio', 'stock', 'inactivo']::text[]);

create function public.venta_items_producto_activo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
begin
  select p.nombre into v_nombre
    from public.productos p
   where p.id = new.producto_id and p.comercio_id = new.comercio_id and not p.activo;
  if not found then
    return new;
  end if;

  if exists (select 1 from public.ventas v where v.id = new.venta_id and v.sin_conexion) then
    update public.ventas
       set avisos_sin_conexion = avisos_sin_conexion || 'inactivo'::text
     where id = new.venta_id and not ('inactivo' = any (avisos_sin_conexion));
    return new;
  end if;

  raise exception 'El producto % está desactivado', v_nombre using errcode = 'PV033';
end
$$;

create trigger venta_items_producto_activo
  before insert on public.venta_items
  for each row execute function public.venta_items_producto_activo();

-- Inicio: un inactivo no cuenta para reponer. El resto es copia de 0041.
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
