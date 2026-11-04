-- Fase 5a: cierre de caja con conteo por medio de pago.
--
-- Una caja solo se cierra con cerrar_caja: sin conteo no hay cierre, y un cierre no se corrige.
-- El cajero cuenta a ciegas: caja_medios_a_contar le dice qué contar, sin montos.
--
-- Concurrencia: cerrar_caja bloquea la caja con FOR UPDATE y registrar_venta la toma FOR SHARE. Si
-- hay una venta en curso, el cierre la espera y la cuenta. Si el cierre llega primero, la venta
-- vuelve a leer la caja, la ve cerrada y falla con PV002.
--
--   PV002 caja inexistente o ajena    PV012 caja ya cerrada    PV014 conteo inválido

alter table public.cajas
  add column cerrada_por uuid,
  add column nota_cierre text check (char_length(nota_cierre) <= 300),
  add constraint cajas_cerrada_por_comercio_fkey
    foreign key (cerrada_por, comercio_id) references public.perfiles (id, comercio_id);

-- nombre es snapshot: renombrar un medio de pago no altera cierres pasados.
create table public.caja_cierres (
  caja_id uuid not null,
  comercio_id uuid not null references public.comercios (id),
  medio_pago_id uuid not null,
  nombre text not null,
  esperado numeric(12, 2) not null,
  contado numeric(12, 2) not null check (contado >= 0),
  diferencia numeric(12, 2) generated always as (contado - esperado) stored,
  primary key (caja_id, medio_pago_id),
  foreign key (caja_id, comercio_id) references public.cajas (id, comercio_id),
  foreign key (medio_pago_id, comercio_id) references public.medios_pago (id, comercio_id)
);

create index caja_cierres_comercio_id_idx on public.caja_cierres (comercio_id);

alter table public.caja_cierres enable row level security;

-- Solo lectura: lo escribe cerrar_caja. Hereda la visibilidad de su caja (el EXISTS respeta la RLS
-- de cajas): el cajero ve sus cierres; dueño y encargado, todos los del comercio.
grant select on public.caja_cierres to authenticated;

create policy caja_cierres_select on public.caja_cierres for select to authenticated
  using (exists (select 1 from public.cajas c where c.id = caja_cierres.caja_id));

-- Antes cada usuario podía marcar su caja como cerrada con un UPDATE directo.
drop policy cajas_update on public.cajas;
revoke update (estado, cerrada_at) on public.cajas from authenticated;

-- Qué se cuenta y cuánto se espera en una caja: los medios activos, los que tuvieron ventas aunque
-- ya no estén activos, y el de efectivo, que suma el fondo inicial. No es para la interfaz: el
-- esperado se conoce recién al cerrar. La Fase 5b le suma ingresos y retiros.
create function public.caja_esperado_por_medio(p_caja_id uuid)
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
  )
  select m.id, m.nombre, m.tipo, m.orden,
         coalesce(t.total, 0)
           + case when m.id = (select id from efectivo) then c.monto_inicial else 0 end
    from public.medios_pago m
    join caja c on c.comercio_id = m.comercio_id
    left join public.caja_totales t on t.caja_id = c.id and t.medio_pago_id = m.id
   where m.activo or t.total is not null or m.id = (select id from efectivo)
$$;

revoke execute on function public.caja_esperado_por_medio(uuid) from public, anon, authenticated;

-- Valida que quien pide pueda operar sobre esa caja abierta. Dueño y encargado pueden con las de
-- otros, para que una caja que alguien dejó abierta no quede trabada.
create function public.caja_validar_acceso(p_caja public.cajas, p_uid uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_caja.id is null
     or (p_caja.usuario_id <> p_uid and public.current_rol() not in ('dueno', 'encargado')) then
    raise exception 'La caja no existe o no es tuya' using errcode = 'PV002';
  end if;
  if p_caja.estado <> 'abierta' then
    raise exception 'Esta caja ya está cerrada' using errcode = 'PV012';
  end if;
end
$$;

revoke execute on function public.caja_validar_acceso(public.cajas, uuid)
  from public, anon, authenticated;

-- Lo que hay que contar, sin montos: el cierre es a ciegas.
create function public.caja_medios_a_contar(p_caja_id uuid)
returns table (medio_pago_id uuid, nombre text, tipo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caja public.cajas;
begin
  select * into v_caja from public.cajas
   where id = p_caja_id and comercio_id = public.current_comercio_id();
  perform public.caja_validar_acceso(v_caja, auth.uid());

  return query
    select e.medio_pago_id, e.nombre, e.tipo
      from public.caja_esperado_por_medio(p_caja_id) e
     order by e.orden, e.nombre;
end
$$;

revoke execute on function public.caja_medios_a_contar(uuid) from public, anon;
grant execute on function public.caja_medios_a_contar(uuid) to authenticated;

-- p_conteos: [{ "medio_pago_id": uuid, "contado": number }], uno por cada medio a contar.
create function public.cerrar_caja(p_caja_id uuid, p_conteos jsonb, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_caja public.cajas;
  v_nota text := nullif(btrim(p_nota), '');
  v_falta text;
  v_lineas jsonb;
begin
  select * into v_caja from public.cajas
   where id = p_caja_id and comercio_id = v_comercio
     for update;
  perform public.caja_validar_acceso(v_caja, v_uid);

  if jsonb_typeof(p_conteos) is distinct from 'array' then
    raise exception 'El conteo no es válido' using errcode = 'PV014';
  end if;
  if char_length(v_nota) > 300 then
    raise exception 'La nota no puede superar los 300 caracteres' using errcode = 'PV014';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_conteos) as x (medio_pago_id uuid, contado numeric)
     where x.medio_pago_id is null
        or x.contado is null
        or x.contado < 0
        or x.contado <> round(x.contado, 2)
  ) or exists (
    select 1
      from jsonb_to_recordset(p_conteos) as x (medio_pago_id uuid, contado numeric)
     group by x.medio_pago_id
    having count(*) > 1
  ) or exists (
    select 1
      from jsonb_to_recordset(p_conteos) as x (medio_pago_id uuid, contado numeric)
     where x.medio_pago_id not in (
       select e.medio_pago_id from public.caja_esperado_por_medio(p_caja_id) e
     )
  ) then
    raise exception 'El conteo no es válido' using errcode = 'PV014';
  end if;

  select e.nombre into v_falta
    from public.caja_esperado_por_medio(p_caja_id) e
   where e.medio_pago_id not in (
     select x.medio_pago_id
       from jsonb_to_recordset(p_conteos) as x (medio_pago_id uuid, contado numeric)
   )
   order by e.orden, e.nombre
   limit 1;
  if found then
    raise exception 'Falta contar %', v_falta using errcode = 'PV014';
  end if;

  insert into public.caja_cierres (caja_id, comercio_id, medio_pago_id, nombre, esperado, contado)
  select p_caja_id, v_comercio, e.medio_pago_id, e.nombre, e.esperado, x.contado
    from public.caja_esperado_por_medio(p_caja_id) e
    join jsonb_to_recordset(p_conteos) as x (medio_pago_id uuid, contado numeric)
      on x.medio_pago_id = e.medio_pago_id;

  update public.cajas
     set estado = 'cerrada', cerrada_at = now(), cerrada_por = v_uid, nota_cierre = v_nota
   where id = p_caja_id;

  select jsonb_agg(
           jsonb_build_object(
             'medio_pago_id', c.medio_pago_id, 'nombre', c.nombre, 'esperado', c.esperado,
             'contado', c.contado, 'diferencia', c.diferencia
           ) order by c.nombre)
    into v_lineas
    from public.caja_cierres c
   where c.caja_id = p_caja_id;

  return jsonb_build_object('caja_id', p_caja_id, 'lineas', coalesce(v_lineas, '[]'::jsonb));
end
$$;

revoke execute on function public.cerrar_caja(uuid, jsonb, text) from public, anon;
grant execute on function public.cerrar_caja(uuid, jsonb, text) to authenticated;

-- cajas ahora tiene dos claves foráneas a perfiles y PostgREST tiene que enterarse.
notify pgrst, 'reload schema';
