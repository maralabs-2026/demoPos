-- Bloque 3.4b: compras a proveedores.
--
-- registrar_compra hace todo en una transacción: cabecera, ítems, un ingreso de stock por producto
-- (con su vencimiento), el costo nuevo del producto y un gasto de tipo 'mercaderia'. El precio de
-- venta no cambia: la función devuelve los productos cuyo costo subió para mostrar el margen.
--
-- El gasto de mercadería sale de la caja y entra en el arqueo como cualquier gasto, pero no resta en
-- la ganancia neta: la ganancia estimada ya descuenta el costo de lo vendido, y si no se contaría dos
-- veces. Solo lo genera una compra: registrar_gasto sigue aceptando fijo o variable.
--
-- Una compra no se edita ni se anula: un error se corrige con un ajuste de stock, anulando el gasto
-- y cambiando el costo del producto.
--
--   PV028 compra inválida

alter table public.gastos drop constraint gastos_tipo_check;
alter table public.gastos
  add constraint gastos_tipo_check check (tipo in ('fijo', 'variable', 'mercaderia'));

create table public.compras (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  proveedor_id uuid not null,
  comprobante text check (comprobante is null or char_length(comprobante) <= 60),
  total numeric(12, 2) not null check (total > 0),
  gasto_id uuid not null references public.gastos (id),
  usuario_id uuid not null,
  created_at timestamptz not null default now(),
  unique (id, comercio_id),
  foreign key (proveedor_id, comercio_id) references public.proveedores (id, comercio_id),
  foreign key (usuario_id, comercio_id) references public.perfiles (id, comercio_id)
);

create index compras_comercio_created_idx on public.compras (comercio_id, created_at desc);

-- nombre y costos son snapshot: cambiar el producto después no altera la compra.
create table public.compra_items (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  compra_id uuid not null,
  producto_id uuid not null,
  nombre text not null,
  cantidad integer not null check (cantidad > 0),
  costo_lista numeric(12, 2) not null check (costo_lista >= 0),
  bonificacion_pct numeric(5, 2) not null check (bonificacion_pct between 0 and 100),
  costo_unitario numeric(12, 2) not null check (costo_unitario >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  vencimiento date,
  foreign key (compra_id, comercio_id) references public.compras (id, comercio_id),
  foreign key (producto_id, comercio_id) references public.productos (id, comercio_id)
);

create index compra_items_compra_idx on public.compra_items (compra_id);

alter table public.compras enable row level security;
alter table public.compra_items enable row level security;

-- Solo lectura y solo dueño y encargado, porque tienen costos. Se escriben con registrar_compra.
grant select on public.compras, public.compra_items to authenticated;

create policy compras_select on public.compras for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy compra_items_select on public.compra_items for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

-- p_pago: 'caja' (sale de p_caja_id), 'fuera' (pagada por fuera) o 'por_pagar' (con p_vencimiento).
create function public.registrar_compra(
  p_proveedor_id uuid,
  p_comprobante text,
  p_items jsonb,
  p_pago text,
  p_caja_id uuid default null,
  p_vencimiento date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_proveedor public.proveedores;
  v_comprobante text := nullif(btrim(p_comprobante), '');
  v_compra uuid := gen_random_uuid();
  v_gasto uuid;
  v_detalle text;
  v_item record;
  v_prod record;
  v_anterior numeric(12, 2);
  v_costo numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_lineas jsonb := '[]'::jsonb;
  v_linea jsonb;
  v_suben jsonb := '[]'::jsonb;
begin
  perform public.gasto_validar_rol();

  if p_pago is null or p_pago not in ('caja', 'fuera', 'por_pagar')
     or (p_pago = 'caja' and p_caja_id is null)
     or (p_pago <> 'caja' and p_caja_id is not null)
     or (p_pago <> 'por_pagar' and p_vencimiento is not null)
     or (v_comprobante is not null and char_length(v_comprobante) > 60)
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'La compra no es válida' using errcode = 'PV028';
  end if;

  select * into v_proveedor from public.proveedores
   where id = p_proveedor_id and comercio_id = v_comercio and activo;
  if not found then
    raise exception 'El proveedor no existe o está inactivo' using errcode = 'PV028';
  end if;

  -- Productos bloqueados en orden de id, igual que registrar_venta.
  for v_item in
    select (e ->> 'producto_id')::uuid as producto_id,
           (e ->> 'cantidad')::integer as cantidad,
           (e ->> 'costo_lista')::numeric as costo_lista,
           coalesce(nullif(e ->> 'bonificacion_pct', '')::numeric, 0) as bonificacion,
           nullif(e ->> 'vencimiento', '')::date as vencimiento,
           count(*) over (partition by e ->> 'producto_id') as repeticiones
      from jsonb_array_elements(p_items) e
     order by 1
  loop
    if v_item.repeticiones > 1
       or v_item.cantidad is null or v_item.cantidad not between 1 and 100000
       or v_item.costo_lista is null or v_item.costo_lista < 0
       or v_item.costo_lista > 9999999999.99
       or v_item.costo_lista <> round(v_item.costo_lista, 2)
       or v_item.bonificacion not between 0 and 100
       or v_item.bonificacion <> round(v_item.bonificacion, 2) then
      raise exception 'La compra no es válida' using errcode = 'PV028';
    end if;

    select id, nombre, precio, controla_stock, precio_libre into v_prod
      from public.productos
     where id = v_item.producto_id and comercio_id = v_comercio
       for update;
    if not found then
      raise exception 'Un producto de la compra no existe' using errcode = 'PV005';
    end if;
    if not v_prod.controla_stock then
      raise exception 'Un servicio no lleva stock' using errcode = 'PV027';
    end if;

    v_costo := round(v_item.costo_lista * (1 - v_item.bonificacion / 100), 2);
    v_subtotal := round(v_costo * v_item.cantidad, 2);
    v_total := v_total + v_subtotal;

    select costo into v_anterior from public.productos_costos where producto_id = v_prod.id;
    if v_anterior is not null and v_costo > v_anterior
       and v_prod.precio > 0 and not v_prod.precio_libre then
      v_suben := v_suben || jsonb_build_array(jsonb_build_object(
        'producto_id', v_prod.id, 'nombre', v_prod.nombre, 'precio', v_prod.precio,
        'costo_anterior', v_anterior, 'costo_nuevo', v_costo));
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod.id, 'nombre', v_prod.nombre, 'cantidad', v_item.cantidad,
      'costo_lista', v_item.costo_lista, 'bonificacion', v_item.bonificacion,
      'costo', v_costo, 'subtotal', v_subtotal, 'vencimiento', v_item.vencimiento));
  end loop;

  if v_total <= 0 or v_total > 9999999999.99 then
    raise exception 'La compra no es válida' using errcode = 'PV028';
  end if;

  v_detalle := v_proveedor.nombre || coalesce(' · ' || v_comprobante, '');

  insert into public.gastos (comercio_id, descripcion, tipo, monto, vencimiento, usuario_id)
  values (v_comercio, left('Compra: ' || v_detalle, 150), 'mercaderia', v_total, p_vencimiento, v_uid)
  returning id into v_gasto;

  insert into public.compras
    (id, comercio_id, proveedor_id, comprobante, total, gasto_id, usuario_id)
  values
    (v_compra, v_comercio, v_proveedor.id, v_comprobante, v_total, v_gasto, v_uid);

  for v_linea in select value from jsonb_array_elements(v_lineas) loop
    insert into public.compra_items
      (comercio_id, compra_id, producto_id, nombre, cantidad, costo_lista, bonificacion_pct,
       costo_unitario, subtotal, vencimiento)
    values
      (v_comercio, v_compra, (v_linea ->> 'producto_id')::uuid, v_linea ->> 'nombre',
       (v_linea ->> 'cantidad')::integer, (v_linea ->> 'costo_lista')::numeric,
       (v_linea ->> 'bonificacion')::numeric, (v_linea ->> 'costo')::numeric,
       (v_linea ->> 'subtotal')::numeric, (v_linea ->> 'vencimiento')::date);

    insert into public.movimientos_stock
      (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id, vencimiento)
    values
      (v_comercio, (v_linea ->> 'producto_id')::uuid, 'ingreso',
       (v_linea ->> 'cantidad')::integer, left('Compra: ' || v_detalle, 200), v_uid,
       (v_linea ->> 'vencimiento')::date);

    insert into public.productos_costos (producto_id, comercio_id, costo)
    values ((v_linea ->> 'producto_id')::uuid, v_comercio, (v_linea ->> 'costo')::numeric)
    on conflict (producto_id) do update
      set costo = excluded.costo, updated_at = now();
  end loop;

  if p_pago <> 'por_pagar' then
    perform public.pagar_gasto(v_gasto, p_caja_id);
  end if;

  return jsonb_build_object('compra_id', v_compra, 'total', v_total, 'suben', v_suben);
end
$$;

revoke execute on function public.registrar_compra(uuid, text, jsonb, text, uuid, date)
  from public, anon;
grant execute on function public.registrar_compra(uuid, text, jsonb, text, uuid, date)
  to authenticated;

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
  v_corte interval := public.corte_dia_comercial();
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

  -- Cada día va de la hora de corte a la misma hora del día siguiente.
  v_inicio := (p_desde::timestamp + v_corte) at time zone c_tz;
  v_fin := ((p_hasta + 1)::timestamp + v_corte) at time zone c_tz;

  with ventas_periodo as (
    select v.id, v.total, v.descuento, v.estado, v.usuario_id,
           date_trunc(v_trunc, (v.created_at at time zone c_tz) - v_corte)::date as periodo
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
                            -- La mercadería ya resta como costo de lo vendido (0035).
                            and g.tipo <> 'mercaderia'
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
