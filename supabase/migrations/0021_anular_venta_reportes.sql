-- Fase 6a: anulación de ventas, reporte de ventas y datos del ticket.
--
-- Anular una venta no la borra: la marca, devuelve el stock y resuelve la plata en una transacción.
--   - Caja de la venta abierta: sin movimiento. La venta anulada deja de sumar en caja_totales, así
--     que un egreso la descontaría dos veces.
--   - Caja de la venta cerrada: el cierre no cambia. El efectivo sale con un retiro de la caja
--     abierta de quien anula; sin caja abierta no se puede. Los otros medios se devuelven por fuera.
--
-- Concurrencia: anular_venta toma la caja de la venta FOR SHARE. Si hay un cierre en curso, lo espera
-- y ve la caja cerrada; si el cierre llega después, ya cuenta la venta como anulada.
--
--   42501 sin permiso    PV018 hace falta una caja abierta    PV019 venta ya anulada
--   PV020 datos inválidos o venta inexistente

alter table public.ventas
  add column anulada_at timestamptz,
  add column anulada_por uuid,
  add column motivo_anulacion text check (char_length(motivo_anulacion) <= 200),
  add constraint ventas_anulada_por_comercio_fkey
    foreign key (anulada_por, comercio_id) references public.perfiles (id, comercio_id);

alter table public.caja_movimientos
  add column venta_id uuid,
  add constraint caja_movimientos_venta_comercio_fkey
    foreign key (venta_id, comercio_id) references public.ventas (id, comercio_id);

alter table public.movimientos_stock drop constraint movimientos_stock_tipo_check;
alter table public.movimientos_stock
  add constraint movimientos_stock_tipo_check
    check (tipo in ('ingreso', 'venta', 'ajuste', 'anulacion'));

create function public.anular_venta(p_venta_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_motivo text := btrim(p_motivo);
  v_venta public.ventas;
  v_estado_caja text;
  v_efectivo numeric;
  v_caja_retiro uuid;
  v_movimiento uuid;
begin
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'No tenés permiso para anular ventas' using errcode = '42501';
  end if;
  if v_motivo is null or char_length(v_motivo) not between 1 and 180 then
    raise exception 'El motivo no es válido' using errcode = 'PV020';
  end if;

  select * into v_venta from public.ventas
   where id = p_venta_id and comercio_id = v_comercio
     for update;
  if v_venta.id is null then
    raise exception 'La venta no existe' using errcode = 'PV020';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta ya está anulada' using errcode = 'PV019';
  end if;

  select estado into v_estado_caja from public.cajas where id = v_venta.caja_id for share;

  if v_estado_caja <> 'abierta' then
    select coalesce(sum(p.monto), 0) into v_efectivo
      from public.venta_pagos p
      join public.medios_pago m on m.id = p.medio_pago_id
     where p.venta_id = p_venta_id and m.tipo = 'efectivo';

    if v_efectivo > 0 then
      select id into v_caja_retiro from public.cajas
       where usuario_id = v_uid and comercio_id = v_comercio and estado = 'abierta';
      if v_caja_retiro is null then
        raise exception 'Abrí tu caja para devolver el efectivo' using errcode = 'PV018';
      end if;
      v_movimiento := public.registrar_movimiento_caja(
        v_caja_retiro, 'retiro', v_efectivo, 'Venta anulada: ' || v_motivo
      );
      update public.caja_movimientos set venta_id = p_venta_id where id = v_movimiento;
    end if;
  end if;

  update public.ventas
     set estado = 'anulada', anulada_at = now(), anulada_por = v_uid, motivo_anulacion = v_motivo
   where id = p_venta_id;

  -- Orden fijo por producto: el trigger bloquea cada uno y así no se cruza con otra anulación.
  insert into public.movimientos_stock
    (comercio_id, producto_id, tipo, cantidad, motivo, venta_id, usuario_id)
  select v_comercio, m.producto_id, 'anulacion', -sum(m.cantidad), v_motivo, p_venta_id, v_uid
    from public.movimientos_stock m
   where m.venta_id = p_venta_id and m.tipo = 'venta'
   group by m.producto_id
   order by m.producto_id;

  return jsonb_build_object('retiro', v_efectivo, 'caja_retiro_id', v_caja_retiro);
end
$$;

revoke execute on function public.anular_venta(uuid, text) from public, anon;
grant execute on function public.anular_venta(uuid, text) to authenticated;

-- Reporte de ventas completadas de un período, por fecha de venta en la zona del comercio. Corre
-- con los permisos de quien lo pide: la RLS es la barrera de los costos.
--
-- El descuento sobre el total se reparte entre los ítems, para que lo vendido sume el total de las
-- ventas. La ganancia solo cuenta ítems con costo: sin costo cargado no se sabe, y sin_costo
-- informa cuánto quedó afuera.
create function public.reporte_ventas(
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
      'sin_costo', (select round(coalesce(sum(neto), 0), 2) from items where costo is null)
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

revoke execute on function public.reporte_ventas(date, date, text, uuid) from public, anon;
grant execute on function public.reporte_ventas(date, date, text, uuid) to authenticated;

-- Textos del ticket: viven en datos. Conserva lo que el comercio ya tenga cargado.
insert into public.configuracion (comercio_id, clave, valor)
select id, 'ticket',
       jsonb_build_object('titulo', nombre, 'leyenda', 'Ticket no fiscal', 'pie', 'Gracias por tu compra')
  from public.comercios
on conflict (comercio_id, clave)
do update set valor = excluded.valor || public.configuracion.valor, updated_at = now();

notify pgrst, 'reload schema';
