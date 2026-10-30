-- Fase 4d-2: combo fijo. Varios productos distintos por un precio fijo (ej. Coca + Pepsi por $ X).
--
-- Reglas acordadas (29/10):
--   - El combo se aplica solo si están todos sus productos en el ticket, en la cantidad pedida.
--   - Si entran varias veces, se aplica la mayor cantidad de combos completos, sin reusar ítems.
--   - El combo se calcula sobre el precio de lista. Las unidades que entran en un combo no
--     reciben además la promo por línea; el resto de las unidades sí.
--   - El descuento del combo se reparte entre sus líneas en proporción al precio de cada una
--     (el centavo de redondeo va a la línea de menor producto_id).
--   - Se suma con el descuento manual, que se calcula sobre el precio ya promocionado.
--   - El combo no aplica si su precio no es menor que la suma de sus productos.
--
-- Son tablas propias y no filas de promociones: un combo necesita varios productos.

create table public.combos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  precio numeric(12, 2) not null check (precio >= 0),
  dias smallint[] not null default '{0,1,2,3,4,5,6}',
  desde time not null default '00:00',
  hasta time not null default '23:59:59',
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, comercio_id),
  check (cardinality(dias) between 1 and 7 and dias <@ '{0,1,2,3,4,5,6}'::smallint[]),
  check (desde <= hasta)
);

create table public.combo_items (
  combo_id uuid not null,
  comercio_id uuid not null references public.comercios (id),
  producto_id uuid not null,
  cantidad integer not null check (cantidad > 0),
  primary key (combo_id, producto_id),
  foreign key (combo_id, comercio_id) references public.combos (id, comercio_id) on delete cascade,
  foreign key (producto_id, comercio_id) references public.productos (id, comercio_id)
);

create index combo_items_comercio_idx on public.combo_items (comercio_id);

alter table public.combos enable row level security;
alter table public.combo_items enable row level security;
grant select, insert, update, delete on public.combos to authenticated;
grant select, insert, update, delete on public.combo_items to authenticated;

-- Igual que las promos: todos leen, dueño y encargado escriben.
create policy combos_select on public.combos for select to authenticated
  using (comercio_id = public.current_comercio_id());
create policy combos_insert on public.combos for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy combos_update on public.combos for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  )
  with check (comercio_id = public.current_comercio_id());
create policy combos_delete on public.combos for delete to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

create policy combo_items_select on public.combo_items for select to authenticated
  using (comercio_id = public.current_comercio_id());
create policy combo_items_insert on public.combo_items for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy combo_items_update on public.combo_items for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  )
  with check (comercio_id = public.current_comercio_id());
create policy combo_items_delete on public.combo_items for delete to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

-- registrar_venta con combos. Misma firma que la 0013. Pasos:
--   1. Validar y bloquear cada producto; guardar las líneas en una tabla temporal.
--   2. Aplicar combos sobre el ticket completo, por orden de creación.
--   3. Por línea: promo de mayor descuento sobre las unidades que no entraron en un combo,
--      y después el descuento manual sobre el precio ya promocionado.
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
  v_combo record;
  v_ci record;
  v_linea record;
  v_promo public.promociones;
  v_promo_mejor public.promociones;
  v_promo_d numeric(12, 2);
  v_promo_mejor_d numeric(12, 2);
  v_k integer;
  v_n integer;
  v_presentes integer;
  v_bruto_unit numeric(12, 2);
  v_bruto_k numeric(12, 2);
  v_desc_unit numeric(12, 2);
  v_desc_k numeric(12, 2);
  v_share numeric(12, 2);
  v_otros numeric(12, 2);
  v_primero uuid;
  v_restante integer;
  v_bruto numeric(12, 2);
  v_manual numeric(12, 2);
  v_desc_item numeric(12, 2);
  v_nombres text;
  v_linea_json jsonb;
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

  -- Paso 1: bloquear productos, validar y guardar las líneas.
  drop table if exists pg_temp._lineas;
  create temp table _lineas (
    producto_id uuid primary key,
    nombre text not null,
    precio numeric(12, 2) not null,
    categoria_id uuid,
    cantidad integer not null,
    pct numeric not null,
    consumido integer not null default 0,
    combo_desc numeric(12, 2) not null default 0,
    combo_nombres text[] not null default '{}'
  ) on commit drop;

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

    insert into pg_temp._lineas (producto_id, nombre, precio, categoria_id, cantidad, pct)
    values (v_prod.id, v_prod.nombre, v_prod.precio, v_prod.categoria_id,
            v_item.cantidad, v_item.pct);
  end loop;

  -- Paso 2: combos, por orden de creación. Cada combo toma todas las veces que entre completo
  -- con las unidades que todavía no usó otro combo.
  for v_combo in
    select c.id, c.nombre, c.precio
      from public.combos c
     where c.comercio_id = v_comercio
       and c.activa
       and (v_dow = any (c.dias))
       and v_hora between c.desde and c.hasta
     order by c.created_at, c.id
  loop
    select count(*),
           count(l.producto_id),
           min(floor((l.cantidad - l.consumido) / ci.cantidad)),
           sum(l.precio * ci.cantidad)
      into v_n, v_presentes, v_k, v_bruto_unit
      from public.combo_items ci
      left join pg_temp._lineas l on l.producto_id = ci.producto_id
     where ci.combo_id = v_combo.id;

    if v_n < 2 or v_presentes < v_n then
      continue;
    end if;
    v_k := coalesce(v_k, 0);
    v_desc_unit := v_bruto_unit - v_combo.precio;
    if v_k <= 0 or v_desc_unit <= 0 then
      continue;
    end if;

    v_desc_k := v_desc_unit * v_k;
    v_bruto_k := v_bruto_unit * v_k;
    select min(ci.producto_id::text)::uuid into v_primero
      from public.combo_items ci where ci.combo_id = v_combo.id;

    -- Reparto: a cada línea su parte redondeada; la de menor producto_id toma el resto.
    select coalesce(sum(round(v_desc_k * (l.precio * ci.cantidad * v_k) / v_bruto_k, 2)), 0)
      into v_otros
      from public.combo_items ci
      join pg_temp._lineas l on l.producto_id = ci.producto_id
     where ci.combo_id = v_combo.id and ci.producto_id <> v_primero;

    for v_ci in
      select ci.producto_id, ci.cantidad, l.precio
        from public.combo_items ci
        join pg_temp._lineas l on l.producto_id = ci.producto_id
       where ci.combo_id = v_combo.id
    loop
      v_share := case when v_ci.producto_id = v_primero
        then v_desc_k - v_otros
        else round(v_desc_k * (v_ci.precio * v_ci.cantidad * v_k) / v_bruto_k, 2)
      end;
      update pg_temp._lineas
         set consumido = consumido + v_ci.cantidad * v_k,
             combo_desc = combo_desc + v_share,
             combo_nombres = array_append(combo_nombres, v_combo.nombre)
       where producto_id = v_ci.producto_id;
    end loop;
  end loop;

  -- Paso 3: por línea, promo sobre las unidades libres del combo; después el manual.
  for v_linea in select * from pg_temp._lineas order by producto_id loop
    v_restante := v_linea.cantidad - v_linea.consumido;
    v_promo_mejor_d := 0;
    v_promo_mejor := null;

    if v_restante > 0 then
      for v_promo in
        select * from public.promociones p
         where p.comercio_id = v_comercio
           and p.activa
           and (v_dow = any (p.dias))
           and v_hora between p.desde and p.hasta
           and ((p.alcance = 'producto' and p.producto_id = v_linea.producto_id)
             or (p.alcance = 'categoria' and p.categoria_id = v_linea.categoria_id))
         -- En un empate gana la promo más antigua: la pantalla usa el mismo orden.
         order by p.created_at, p.id
      loop
        v_promo_d := public.descuento_promocion(v_promo, v_linea.precio, v_restante);
        if v_promo_d > v_promo_mejor_d then
          v_promo_mejor_d := v_promo_d;
          v_promo_mejor := v_promo;
        end if;
      end loop;
    end if;

    v_bruto := v_linea.precio * v_linea.cantidad;
    v_manual := round((v_bruto - v_linea.combo_desc - v_promo_mejor_d) * v_linea.pct / 100, 2);
    v_desc_item := v_linea.combo_desc + v_promo_mejor_d + v_manual;
    v_neto := v_neto + v_bruto - v_desc_item;

    v_nombres := array_to_string(v_linea.combo_nombres, ' + ');
    if v_promo_mejor_d > 0 then
      v_nombres := case when v_nombres = '' then v_promo_mejor.nombre
        else v_nombres || ' + ' || v_promo_mejor.nombre end;
    end if;

    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'producto_id', v_linea.producto_id,
      'nombre', v_linea.nombre,
      'precio', v_linea.precio,
      'cantidad', v_linea.cantidad,
      'promo_nombre', case when v_linea.combo_desc + v_promo_mejor_d > 0 then v_nombres end,
      'promo_descuento', v_linea.combo_desc + v_promo_mejor_d,
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

  -- Paso 4: ítems con snapshot (precio, promo y descuentos) y movimientos de stock.
  for v_linea_json in select value from jsonb_array_elements(v_lineas) loop
    insert into public.venta_items
      (comercio_id, venta_id, producto_id, nombre, precio_unitario, cantidad,
       descuento, promocion_nombre, promocion_descuento, subtotal)
    values
      (v_comercio, v_venta_id,
       (v_linea_json ->> 'producto_id')::uuid,
       v_linea_json ->> 'nombre',
       (v_linea_json ->> 'precio')::numeric,
       (v_linea_json ->> 'cantidad')::integer,
       (v_linea_json ->> 'descuento')::numeric,
       v_linea_json ->> 'promo_nombre',
       (v_linea_json ->> 'promo_descuento')::numeric,
       (v_linea_json ->> 'precio')::numeric * (v_linea_json ->> 'cantidad')::integer
         - (v_linea_json ->> 'descuento')::numeric);

    insert into public.movimientos_stock
      (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id)
    values
      (v_comercio, (v_linea_json ->> 'producto_id')::uuid, 'venta',
       -((v_linea_json ->> 'cantidad')::integer), v_venta_id, v_uid);
  end loop;

  -- Pagos: igual que en 0012 y 0013.
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
