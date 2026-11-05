-- Fase 5b: retiros e ingresos de efectivo durante el turno, con motivo, que entran en el arqueo.
--
-- Efectivo esperado al cierre = fondo inicial + ventas en efectivo + ingresos - retiros.
--
-- Un movimiento no se edita ni se borra: un error se compensa cargando el movimiento contrario. No
-- se limita un retiro a lo que hay en el cajón: ese límite revelaría el esperado, y el conteo es a
-- ciegas.
--
-- Concurrencia: registrar_movimiento_caja toma la caja FOR SHARE, como registrar_venta. Si hay uno
-- en curso, cerrar_caja lo espera y lo cuenta. Si el cierre llega primero, el movimiento falla.
--
--   PV002 caja inexistente o ajena    PV012 caja ya cerrada    PV015 movimiento inválido

create table public.caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null,
  comercio_id uuid not null references public.comercios (id),
  usuario_id uuid not null,
  tipo text not null check (tipo in ('ingreso', 'retiro')),
  monto numeric(12, 2) not null check (monto > 0),
  motivo text not null check (char_length(btrim(motivo)) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (caja_id, comercio_id) references public.cajas (id, comercio_id),
  foreign key (usuario_id, comercio_id) references public.perfiles (id, comercio_id)
);

create index caja_movimientos_caja_id_idx on public.caja_movimientos (caja_id, created_at);
create index caja_movimientos_comercio_id_idx on public.caja_movimientos (comercio_id);

alter table public.caja_movimientos enable row level security;

-- Solo lectura: lo escribe registrar_movimiento_caja. Hereda la visibilidad de su caja (el EXISTS
-- respeta la RLS de cajas): el cajero ve los de su caja; dueño y encargado, todos los del comercio.
grant select on public.caja_movimientos to authenticated;

create policy caja_movimientos_select on public.caja_movimientos for select to authenticated
  using (exists (select 1 from public.cajas c where c.id = caja_movimientos.caja_id));

-- Igual que en 0018, más el neto de ingresos y retiros en el medio de efectivo. Los permisos se
-- conservan: sigue siendo interna, porque el esperado se conoce recién al cerrar.
create or replace function public.caja_esperado_por_medio(p_caja_id uuid)
returns table (medio_pago_id uuid, nombre text, tipo text, orden integer, esperado numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with caja as (
    select id, comercio_id, monto_inicial from public.cajas where id = p_caja_id
  ), efectivo as (
    -- Con varios medios de efectivo, el fondo va a uno solo, siempre el mismo.
    select m.id
      from public.medios_pago m
      join caja c on c.comercio_id = m.comercio_id
     where m.tipo = 'efectivo'
     order by m.activo desc, m.orden, m.created_at, m.id
     limit 1
  ), neto as (
    select coalesce(sum(case when cm.tipo = 'ingreso' then cm.monto else -cm.monto end), 0) as total
      from public.caja_movimientos cm
     where cm.caja_id = p_caja_id
  )
  select m.id, m.nombre, m.tipo, m.orden,
         coalesce(t.total, 0)
           + case when m.id = (select id from efectivo)
                  then c.monto_inicial + (select total from neto)
                  else 0 end
    from public.medios_pago m
    join caja c on c.comercio_id = m.comercio_id
    left join public.caja_totales t on t.caja_id = c.id and t.medio_pago_id = m.id
   where m.activo or t.total is not null or m.id = (select id from efectivo)
$$;

create function public.registrar_movimiento_caja(
  p_caja_id uuid,
  p_tipo text,
  p_monto numeric,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_caja public.cajas;
  v_motivo text := btrim(p_motivo);
  v_id uuid;
begin
  select * into v_caja from public.cajas
   where id = p_caja_id and comercio_id = v_comercio
     for share;
  perform public.caja_validar_acceso(v_caja, v_uid);

  if p_tipo is null or p_tipo not in ('ingreso', 'retiro') then
    raise exception 'El tipo de movimiento no es válido' using errcode = 'PV015';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > 9999999999.99 or p_monto <> round(p_monto, 2) then
    raise exception 'El monto no es válido' using errcode = 'PV015';
  end if;
  if v_motivo is null or char_length(v_motivo) not between 1 and 200 then
    raise exception 'El motivo no es válido' using errcode = 'PV015';
  end if;

  insert into public.caja_movimientos (caja_id, comercio_id, usuario_id, tipo, monto, motivo)
  values (p_caja_id, v_comercio, v_uid, p_tipo, p_monto, v_motivo)
  returning id into v_id;

  return v_id;
end
$$;

revoke execute on function public.registrar_movimiento_caja(uuid, text, numeric, text)
  from public, anon;
grant execute on function public.registrar_movimiento_caja(uuid, text, numeric, text)
  to authenticated;

notify pgrst, 'reload schema';
