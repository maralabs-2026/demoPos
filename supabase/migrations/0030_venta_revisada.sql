-- Bloque 3.2c-2: el dueño o el encargado revisan las ventas cobradas sin conexión que quedaron con
-- avisos (precio distinto del catálogo o stock negativo, ver 0028).
--
-- Revisar es solo dejar constancia: no cambia la venta, el stock ni la caja. Si hace falta corregir
-- algo, se hace con un ajuste de stock o anulando la venta, como siempre. Marcarla dos veces no
-- cambia quién la revisó primero.
--
--   PV026 la venta no existe o no se cobró sin conexión

alter table public.ventas
  add column revisada_at timestamptz,
  add column revisada_por uuid,
  add constraint ventas_revisada_por_comercio_fkey
    foreign key (revisada_por, comercio_id) references public.perfiles (id, comercio_id),
  add constraint ventas_revisada_completa
    check ((revisada_at is null) = (revisada_por is null)),
  add constraint ventas_revisada_solo_sin_conexion
    check (revisada_at is null or sin_conexion);

-- Las que muestra el inicio: sin conexión, con avisos y sin revisar.
create index ventas_sin_conexion_a_revisar_idx
  on public.ventas (comercio_id, created_at desc)
  where sin_conexion and revisada_at is null;

create function public.marcar_venta_revisada(p_venta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_venta public.ventas;
begin
  if v_uid is null or v_comercio is null or public.current_rol() is null
     or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede revisar ventas' using errcode = '42501';
  end if;

  select * into v_venta
    from public.ventas
   where id = p_venta_id and comercio_id = v_comercio
     for update;
  if not found or not v_venta.sin_conexion then
    raise exception 'La venta no existe o no se cobró sin conexión' using errcode = 'PV026';
  end if;

  if v_venta.revisada_at is null then
    update public.ventas
       set revisada_at = now(), revisada_por = v_uid
     where id = p_venta_id
    returning * into v_venta;
  end if;

  return jsonb_build_object(
    'venta_id', v_venta.id,
    'revisada_at', v_venta.revisada_at,
    'revisada_por', v_venta.revisada_por
  );
end
$$;

revoke execute on function public.marcar_venta_revisada(uuid) from public, anon;
grant execute on function public.marcar_venta_revisada(uuid) to authenticated;
