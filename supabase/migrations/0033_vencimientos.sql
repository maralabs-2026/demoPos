-- Bloque 3.3: vencimientos por ingreso de mercadería.
--
-- Cada ingreso puede llevar su fecha. El stock se descuenta por producto y no por ingreso, así que
-- las unidades que quedan de cada vencimiento son una estimación: se supone que se vende primero lo
-- que vence antes, y el stock actual se reparte desde el vencimiento más lejano hacia el más cercano.
-- El stock cargado sin fecha no se descuenta de esa cuenta: es preferible avisar de más.
--
-- vencimientos_proximos() devuelve lo que ya venció o vence dentro de los días de aviso (clave
-- vencimiento_aviso_dias, de 1 a 180; sin la clave o con un valor inválido, 30). Solo dueño y
-- encargado, que son quienes ven el inicio.

alter table public.movimientos_stock
  add column vencimiento date,
  add constraint movimientos_stock_vencimiento_solo_ingreso
    check (vencimiento is null or tipo = 'ingreso');

grant insert (vencimiento) on public.movimientos_stock to authenticated;

create index movimientos_stock_vencimiento_idx
  on public.movimientos_stock (comercio_id, producto_id, vencimiento)
  where vencimiento is not null;

create function public.vencimientos_proximos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_comercio uuid := public.current_comercio_id();
  v_hoy date := (now() at time zone 'America/Argentina/Cordoba')::date;
  v_valor jsonb;
  v_dias integer := 30;
  v_lista jsonb;
begin
  if v_comercio is null or public.current_rol() is null
     or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede ver los vencimientos' using errcode = '42501';
  end if;

  select valor into v_valor
    from public.configuracion
   where comercio_id = v_comercio and clave = 'vencimiento_aviso_dias';
  if jsonb_typeof(v_valor) = 'number'
     and (v_valor #>> '{}')::numeric between 1 and 180
     and (v_valor #>> '{}')::numeric = trunc((v_valor #>> '{}')::numeric) then
    v_dias := (v_valor #>> '{}')::integer;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'producto_id', x.producto_id,
           'nombre', x.nombre,
           'unidad_venta', x.unidad_venta,
           'vencimiento', x.vencimiento,
           'cantidad', x.restante,
           'vencido', x.vencimiento < v_hoy
         ) order by x.vencimiento, x.nombre), '[]'::jsonb)
    into v_lista
    from (
      select l.producto_id, l.nombre, l.unidad_venta, l.vencimiento,
             least(l.cantidad, greatest(l.stock_actual - l.posteriores, 0)) as restante
        from (
          select g.*,
                 coalesce(sum(g.cantidad) over (
                   partition by g.producto_id order by g.vencimiento desc
                   rows between unbounded preceding and 1 preceding
                 ), 0) as posteriores
            from (
              select p.id as producto_id, p.nombre, p.unidad_venta, p.stock_actual,
                     m.vencimiento, sum(m.cantidad) as cantidad
                from public.movimientos_stock m
                join public.productos p on p.id = m.producto_id
               where m.comercio_id = v_comercio
                 and m.vencimiento is not null
                 and p.controla_stock
                 and p.stock_actual > 0
               group by p.id, p.nombre, p.unidad_venta, p.stock_actual, m.vencimiento
            ) g
        ) l
    ) x
   where x.restante > 0
     and x.vencimiento <= v_hoy + v_dias;

  return v_lista;
end
$$;

revoke execute on function public.vencimientos_proximos() from public, anon;
grant execute on function public.vencimientos_proximos() to authenticated;
