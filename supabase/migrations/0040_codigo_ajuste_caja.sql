-- Código de ajuste: el dueño autoriza a distancia un ajuste de caja que carga otro.
--
-- El dueño genera un código de 6 dígitos para una caja abierta y un monto máximo. Vence a los 10
-- minutos, sirve una sola vez y generar otro para la misma caja anula el anterior. Encargado y
-- cajero lo usan en una caja que ya pueden operar (el cajero, solo en la suya). Con 5 códigos
-- incorrectos el código se anula. El dueño sigue ajustando sin código.
--
-- El código se guarda cifrado y la tabla no se lee desde la app: solo la usan estas funciones.
-- Un código incorrecto no lanza error, devuelve null: así el intento fallido queda guardado.
--
--   42501 sin permiso    PV002 caja inexistente o ajena    PV012 caja ya cerrada
--   PV015 movimiento inválido    PV019 no hay código vigente    PV020 monto mayor al autorizado

create table public.caja_codigos_ajuste (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null,
  comercio_id uuid not null references public.comercios (id),
  codigo_hash text not null,
  monto_max numeric(12, 2) not null check (monto_max > 0),
  creado_por uuid not null,
  created_at timestamptz not null default now(),
  vence_at timestamptz not null,
  intentos integer not null default 0,
  anulado_at timestamptz,
  usado_at timestamptz,
  usado_por uuid,
  foreign key (caja_id, comercio_id) references public.cajas (id, comercio_id),
  foreign key (creado_por, comercio_id) references public.perfiles (id, comercio_id),
  foreign key (usado_por, comercio_id) references public.perfiles (id, comercio_id)
);

create index caja_codigos_ajuste_caja_idx on public.caja_codigos_ajuste (caja_id, created_at desc);
create index caja_codigos_ajuste_comercio_idx on public.caja_codigos_ajuste (comercio_id);

-- RLS sin políticas ni permisos: nadie la lee ni la escribe desde la app.
alter table public.caja_codigos_ajuste enable row level security;

-- Quién autorizó el ajuste: el dueño que generó el código, o null si lo cargó el propio dueño.
alter table public.caja_movimientos
  add column autorizado_por uuid,
  add constraint caja_movimientos_autorizado_por_fkey
    foreign key (autorizado_por, comercio_id) references public.perfiles (id, comercio_id);

create function public.generar_codigo_ajuste(p_caja_id uuid, p_monto_max numeric)
returns table (codigo text, vence_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_caja public.cajas;
  v_codigo text;
  v_vence timestamptz := now() + interval '10 minutes';
begin
  if public.current_rol() is null or public.current_rol() <> 'dueno' then
    raise exception 'Solo el dueño genera códigos de ajuste' using errcode = '42501';
  end if;

  select * into v_caja from public.cajas
   where id = p_caja_id and comercio_id = v_comercio
     for share;
  perform public.caja_validar_acceso(v_caja, v_uid);

  if p_monto_max is null or p_monto_max <= 0 or p_monto_max > 9999999999.99
     or p_monto_max <> round(p_monto_max, 2) then
    raise exception 'El monto máximo no es válido' using errcode = 'PV015';
  end if;

  -- Uno vigente por caja: el nuevo anula a los anteriores.
  update public.caja_codigos_ajuste
     set anulado_at = now()
   where caja_id = p_caja_id and usado_at is null and anulado_at is null;

  v_codigo := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint)
                    % 1000000)::text, 6, '0');

  insert into public.caja_codigos_ajuste
    (caja_id, comercio_id, codigo_hash, monto_max, creado_por, vence_at)
  values
    (p_caja_id, v_comercio, extensions.crypt(v_codigo, extensions.gen_salt('bf', 8)),
     p_monto_max, v_uid, v_vence);

  return query select v_codigo, v_vence;
end
$$;

revoke execute on function public.generar_codigo_ajuste(uuid, numeric) from public, anon;
grant execute on function public.generar_codigo_ajuste(uuid, numeric) to authenticated;

-- Reemplaza la de 0039: suma el código para quien no es el dueño. Devuelve null si el código
-- no es correcto, para que el intento fallido quede registrado.
drop function public.registrar_ajuste_caja(uuid, text, numeric, text);

create function public.registrar_ajuste_caja(
  p_caja_id uuid,
  p_tipo text,
  p_monto numeric,
  p_motivo text,
  p_codigo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comercio uuid := public.current_comercio_id();
  v_rol public.rol_usuario := public.current_rol();
  v_caja public.cajas;
  v_motivo text := btrim(p_motivo);
  v_codigo public.caja_codigos_ajuste;
  v_autorizado_por uuid;
  v_id uuid;
begin
  if v_rol is null then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  select * into v_caja from public.cajas
   where id = p_caja_id and comercio_id = v_comercio
     for share;
  perform public.caja_validar_acceso(v_caja, v_uid);

  if p_tipo is null or p_tipo not in ('ingreso', 'retiro') then
    raise exception 'El tipo de ajuste no es válido' using errcode = 'PV015';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > 9999999999.99 or p_monto <> round(p_monto, 2) then
    raise exception 'El monto no es válido' using errcode = 'PV015';
  end if;
  if v_motivo is null or char_length(v_motivo) not between 1 and 200 then
    raise exception 'El motivo no es válido' using errcode = 'PV015';
  end if;

  if v_rol <> 'dueno' then
    select * into v_codigo from public.caja_codigos_ajuste
     where caja_id = p_caja_id and usado_at is null and anulado_at is null and vence_at > now()
     order by created_at desc
     limit 1
       for update;
    if v_codigo.id is null then
      raise exception 'No hay un código vigente para esta caja' using errcode = 'PV019';
    end if;

    if p_codigo is null or p_codigo !~ '^\d{6}$'
       or extensions.crypt(p_codigo, v_codigo.codigo_hash) <> v_codigo.codigo_hash then
      update public.caja_codigos_ajuste
         set intentos = intentos + 1,
             anulado_at = case when intentos + 1 >= 5 then now() end
       where id = v_codigo.id;
      return null;
    end if;

    if p_monto > v_codigo.monto_max then
      raise exception 'El monto supera el autorizado' using errcode = 'PV020';
    end if;

    update public.caja_codigos_ajuste
       set usado_at = now(), usado_por = v_uid
     where id = v_codigo.id;
    v_autorizado_por := v_codigo.creado_por;
  end if;

  insert into public.caja_movimientos
    (caja_id, comercio_id, usuario_id, tipo, monto, motivo, es_ajuste, autorizado_por)
  values
    (p_caja_id, v_comercio, v_uid, p_tipo, p_monto, v_motivo, true, v_autorizado_por)
  returning id into v_id;

  return v_id;
end
$$;

revoke execute on function public.registrar_ajuste_caja(uuid, text, numeric, text, text)
  from public, anon;
grant execute on function public.registrar_ajuste_caja(uuid, text, numeric, text, text)
  to authenticated;

notify pgrst, 'reload schema';
