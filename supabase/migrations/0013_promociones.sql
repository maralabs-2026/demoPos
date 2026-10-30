-- Fase 4d: promociones que se aplican solas en el ticket.
--
-- Tipos (un solo medio por promo):
--   nxm              lleva L, paga P (2x1: lleva 2, paga 1)
--   precio_cantidad  C unidades por X pesos (docena a $ X)
--   porcentaje       P % de descuento
-- Alcance: un producto o una categoría. Vigencia: días de la semana y franja horaria, en hora de
-- Córdoba (la base guarda UTC; la hora se convierte al evaluar).
--
-- Reglas acordadas (28/10):
--   - Si hay más de una promo que aplica a una línea, gana la que más descuenta.
--   - El descuento manual del ítem (0012) se suma: se calcula sobre el precio ya promocionado.
--   - Las promos son automáticas para cualquier rol y no cuentan para el tope de descuento del
--     cajero, que sigue siendo solo manual.
--   - La promo aplicada queda como snapshot en venta_items (nombre y monto).
--
-- Pendiente (4d-2): combo fijo (varios productos por un precio), que necesita varias líneas.

alter table public.categorias
  add constraint categorias_id_comercio_key unique (id, comercio_id);

create table public.promociones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  tipo text not null check (tipo in ('nxm', 'precio_cantidad', 'porcentaje')),
  alcance text not null check (alcance in ('producto', 'categoria')),
  producto_id uuid,
  categoria_id uuid,
  lleva integer,
  paga integer,
  cantidad integer,
  precio numeric(12, 2),
  porcentaje numeric(5, 2),
  dias smallint[] not null default '{0,1,2,3,4,5,6}',
  desde time not null default '00:00',
  hasta time not null default '23:59:59',
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (producto_id, comercio_id) references public.productos (id, comercio_id),
  foreign key (categoria_id, comercio_id) references public.categorias (id, comercio_id),
  check (
    (alcance = 'producto' and producto_id is not null and categoria_id is null)
    or (alcance = 'categoria' and categoria_id is not null and producto_id is null)
  ),
  check (
    (tipo = 'nxm' and lleva > paga and paga >= 1
      and cantidad is null and precio is null and porcentaje is null)
    or (tipo = 'precio_cantidad' and cantidad >= 2 and precio >= 0
      and lleva is null and paga is null and porcentaje is null)
    or (tipo = 'porcentaje' and porcentaje > 0 and porcentaje <= 100
      and lleva is null and paga is null and cantidad is null and precio is null)
  ),
  check (cardinality(dias) between 1 and 7 and dias <@ '{0,1,2,3,4,5,6}'::smallint[]),
  check (desde <= hasta)
);

create index promociones_comercio_idx on public.promociones (comercio_id);

alter table public.promociones enable row level security;
grant select, insert, update, delete on public.promociones to authenticated;

-- Todos leen las promos del comercio (el cajero las ve en el ticket); dueño y encargado escriben.
create policy promociones_select on public.promociones for select to authenticated
  using (comercio_id = public.current_comercio_id());
create policy promociones_insert on public.promociones for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy promociones_update on public.promociones for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  )
  with check (comercio_id = public.current_comercio_id());
create policy promociones_delete on public.promociones for delete to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

-- Snapshot de la promo en cada ítem de la venta.
alter table public.venta_items
  add column promocion_nombre text,
  add column promocion_descuento numeric(12, 2) not null default 0
    check (promocion_descuento >= 0);

-- Descuento de una promo sobre una línea: cuánto se ahorra el cliente con esa cantidad.
create function public.descuento_promocion(
  p_promo public.promociones,
  p_precio numeric,
  p_cantidad integer
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_bruto numeric := p_precio * p_cantidad;
  v_grupos integer;
  v_cobrado numeric;
begin
  if p_promo.tipo = 'porcentaje' then
    return round(v_bruto * p_promo.porcentaje / 100, 2);
  elsif p_promo.tipo = 'nxm' then
    if p_cantidad < p_promo.lleva then return 0; end if;
    v_grupos := p_cantidad / p_promo.lleva;
    v_cobrado := v_grupos * p_promo.paga * p_precio
      + (p_cantidad % p_promo.lleva) * p_precio;
    return round(v_bruto - v_cobrado, 2);
  elsif p_promo.tipo = 'precio_cantidad' then
    v_grupos := p_cantidad / p_promo.cantidad;
    if v_grupos = 0 then return 0; end if;
    v_cobrado := v_grupos * p_promo.precio
      + (p_cantidad % p_promo.cantidad) * p_precio;
    return greatest(round(v_bruto - v_cobrado, 2), 0);
  end if;
  return 0;
end
$$;

-- registrar_venta con promos. Misma firma que la 0012. Lo que cambia respecto de 0012:
-- en cada línea se aplica la promo vigente de mayor descuento, y el descuento manual se calcula
-- sobre el precio ya promocionado.
create or replace function public.registrar_venta(
  p_caja_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_descuento_pct numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid;
  v_rol public.rol_usuario;
  v_max_pct numeric;
  v_pct_total numeric := coalesce(p_descuento_pct, 0);
  v_ahora timestamp := now() at time zone 'America/Argentina/Cordoba';
  v_dow smallint := extract(dow from v_ahora)::smallint;
  v_hora time := v_ahora::time;
  v_venta_id uuid;
  v_created timestamptz;
  v_neto numeric(12, 2) := 0;
  v_desc_total numeric(12, 2);
  v_total numeric(12, 2);
  v_lineas jsonb := '[]'::jsonb;
  v_pagado numeric(12, 2) := 0;
  v_vuelto_total numeric(12, 2) := 0;
  v_vuelto numeric(12, 2);
  v_recibido numeric(12, 2);
  v_item record;
  v_prod record;
  v_promo public.promociones;
  v_promo_mejor public.promociones;
  v_promo_d numeric(12, 2);
  v_promo_mejor_d numeric(12, 2);
  v_bruto numeric(12, 2);
  v_manual numeric(12, 2);
  v_desc_item numeric(12, 2);
  v_linea jsonb;
  v_pago record;
  v_medio record;
begin
  if v_uid is null then
    raise exception 'Se requiere iniciar sesión' using errcode = '28000';
  end if;

  select comercio_id, rol into v_comercio, v_rol
    from public.perfiles where id = v_uid and activo;
  if v_comercio is null then
    raise exception 'Perfil inexistente o inactivo' using errcode = '42501';
  end if;

  if v_rol = 'cajero' then
    select (valor #>> '{}')::numeric into v_max_pct
      from public.configuracion
     where comercio_id = v_comercio and clave = 'descuento_max_cajero_pct';
    v_max_pct := coalesce(v_max_pct, 10);
  else
    v_max_pct := 100;
  end if;

  if v_pct_total < 0 or v_pct_total > 100 then
    raise exception 'Descuento inválido' using errcode = 'PV004';
  end if;
  if v_pct_total > v_max_pct then
    raise exception 'Descuento sobre el total mayor al permitido (máximo % %%)', v_max_pct
      using errcode = 'PV011', detail = v_max_pct::text;
  end if;

  perform 1 from public.cajas
   where id = p_caja_id and comercio_id = v_comercio and usuario_id = v_uid and estado = 'abierta'
     for share;
  if not found then
    raise exception 'La caja no existe, no es tuya o está cerrada' using errcode = 'PV002';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene ítems' using errcode = 'PV004';
  end if;
  if jsonb_typeof(p_pagos) is distinct from 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene pagos' using errcode = 'PV004';
  end if;

  -- Pasada 1: bloquear productos, validar, elegir la promo de cada línea y calcular el neto.
  for v_item in
    select x.producto_id,
           sum(x.cantidad)::integer as cantidad,
           max(x.pct) as pct,
           count(distinct x.pct) as pcts
      from (
        select (e ->> 'producto_id')::uuid as producto_id,
               (e ->> 'cantidad')::integer as cantidad,
               coalesce(nullif(e ->> 'descuento_pct', '')::numeric, 0) as pct
          from jsonb_array_elements(p_items) e
      ) x
     group by 1
     order by 1
  loop
    if v_item.cantidad is null or v_item.cantidad <= 0 then
      raise exception 'Cantidad inválida' using errcode = 'PV004';
    end if;
    if v_item.pcts > 1 or v_item.pct < 0 or v_item.pct > 100 then
      raise exception 'Descuento inválido' using errcode = 'PV004';
    end if;
    if v_item.pct > v_max_pct then
      raise exception 'Descuento de un producto mayor al permitido (máximo % %%)', v_max_pct
        using errcode = 'PV011', detail = v_max_pct::text;
    end if;

    select id, nombre, precio, stock_actual, categoria_id into v_prod
      from public.productos
     where id = v_item.producto_id and comercio_id = v_comercio
       for update;
    if not found then
      raise exception 'Un producto de la venta no existe' using errcode = 'PV005';
    end if;

    if v_prod.stock_actual < v_item.cantidad then
      raise exception 'Stock insuficiente de "%": quedan %, se pidieron %',
        v_prod.nombre, v_prod.stock_actual, v_item.cantidad
        using errcode = 'PV001', detail = v_prod.id::text;
    end if;

    -- Promo vigente de mayor descuento para esta línea.
    v_promo_mejor_d := 0;
    v_promo_mejor := null;
    for v_promo in
      select * from public.promociones p
       where p.comercio_id = v_comercio
         and p.activa
         and (v_dow = any (p.dias))
         and v_hora between p.desde and p.hasta
         and ((p.alcance = 'producto' and p.producto_id = v_prod.id)
           or (p.alcance = 'categoria' and p.categoria_id = v_prod.categoria_id))
    loop
      v_promo_d := public.descuento_promocion(v_promo, v_prod.precio, v_item.cantidad);
      if v_promo_d > v_promo_mejor_d then
        v_promo_mejor_d := v_promo_d;
        v_promo_mejor := v_promo;
      end if;
    end loop;

    v_bruto := v_prod.precio * v_item.cantidad;
    v_manual := round((v_bruto - v_promo_mejor_d) * v_item.pct / 100, 2);
    v_desc_item := v_promo_mejor_d + v_manual;
    v_neto := v_neto + v_bruto - v_desc_item;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'producto_id', v_prod.id,
      'nombre', v_prod.nombre,
      'precio', v_prod.precio,
      'cantidad', v_item.cantidad,
      'promo_nombre', case when v_promo_mejor_d > 0 then v_promo_mejor.nombre end,
      'promo_descuento', v_promo_mejor_d,
      'descuento', v_desc_item
    ));
  end loop;

  v_desc_total := round(v_neto * v_pct_total / 100, 2);
  v_total := v_neto - v_desc_total;
  if v_total <= 0 then
    raise exception 'El total de la venta debe ser mayor a cero' using errcode = 'PV004';
  end if;

  insert into public.ventas (comercio_id, caja_id, usuario_id, total, descuento)
  values (v_comercio, p_caja_id, v_uid, v_total, v_desc_total)
  returning id, created_at into v_venta_id, v_created;

  -- Pasada 2: ítems con snapshot (precio, promo y descuentos) y movimientos de stock.
  for v_linea in select value from jsonb_array_elements(v_lineas) loop
    insert into public.venta_items
      (comercio_id, venta_id, producto_id, nombre, precio_unitario, cantidad,
       descuento, promocion_nombre, promocion_descuento, subtotal)
    values
      (v_comercio, v_venta_id,
       (v_linea ->> 'producto_id')::uuid,
       v_linea ->> 'nombre',
       (v_linea ->> 'precio')::numeric,
       (v_linea ->> 'cantidad')::integer,
       (v_linea ->> 'descuento')::numeric,
       v_linea ->> 'promo_nombre',
       (v_linea ->> 'promo_descuento')::numeric,
       (v_linea ->> 'precio')::numeric * (v_linea ->> 'cantidad')::integer
         - (v_linea ->> 'descuento')::numeric);

    insert into public.movimientos_stock
      (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id)
    values
      (v_comercio, (v_linea ->> 'producto_id')::uuid, 'venta',
       -((v_linea ->> 'cantidad')::integer), v_venta_id, v_uid);
  end loop;

  -- Pagos: igual que en 0012.
  for v_pago in
    select (e ->> 'medio_pago_id')::uuid as medio_pago_id,
           (e ->> 'monto')::numeric(12, 2) as monto,
           nullif(e ->> 'recibido', '')::numeric(12, 2) as recibido,
           nullif(e ->> 'referencia_externa', '') as referencia_externa
      from jsonb_array_elements(p_pagos) e
  loop
    if v_pago.monto is null or v_pago.monto <= 0 then
      raise exception 'Monto de pago inválido' using errcode = 'PV004';
    end if;

    select id, tipo into v_medio
      from public.medios_pago
     where id = v_pago.medio_pago_id and comercio_id = v_comercio and activo;
    if not found then
      raise exception 'Medio de pago inválido' using errcode = 'PV003';
    end if;

    v_recibido := null;
    v_vuelto := 0;
    if v_medio.tipo = 'efectivo' then
      v_recibido := coalesce(v_pago.recibido, v_pago.monto);
      if v_recibido < v_pago.monto then
        raise exception 'El monto recibido es menor al monto a cobrar' using errcode = 'PV003';
      end if;
      v_vuelto := v_recibido - v_pago.monto;
    elsif v_pago.recibido is not null and v_pago.recibido <> v_pago.monto then
      raise exception 'Este medio de pago cobra el monto exacto' using errcode = 'PV004';
    end if;

    insert into public.venta_pagos
      (comercio_id, venta_id, medio_pago_id, monto, recibido, vuelto, referencia_externa)
    values
      (v_comercio, v_venta_id, v_medio.id, v_pago.monto, v_recibido, v_vuelto,
       v_pago.referencia_externa);

    v_pagado := v_pagado + v_pago.monto;
    v_vuelto_total := v_vuelto_total + v_vuelto;
  end loop;

  if v_pagado <> v_total then
    raise exception 'Los pagos (%) no coinciden con el total (%)', v_pagado, v_total
      using errcode = 'PV003';
  end if;

  return jsonb_build_object(
    'venta_id', v_venta_id,
    'total', v_total,
    'descuento', v_desc_total,
    'vuelto', v_vuelto_total,
    'created_at', v_created
  );
end
$$;

revoke execute on function public.registrar_venta(uuid, jsonb, jsonb, numeric) from public, anon;
grant execute on function public.registrar_venta(uuid, jsonb, jsonb, numeric) to authenticated;
