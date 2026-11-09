-- Ajuste de caja: un movimiento que solo puede registrar el dueño, sobre una caja abierta.
--
-- Es un ingreso o un retiro marcado con es_ajuste, así que entra en el esperado del cierre sin
-- cambiar caja_esperado_por_medio. Como cualquier movimiento, no se edita ni se borra: un error se
-- compensa con otro ajuste. Una caja cerrada no se ajusta, porque un cierre no se corrige.
--
--   42501 sin permiso    PV002 caja inexistente o ajena    PV012 caja ya cerrada
--   PV015 movimiento inválido

alter table public.caja_movimientos
  add column es_ajuste boolean not null default false;

create function public.registrar_ajuste_caja(
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
  if public.current_rol() is null or public.current_rol() <> 'dueno' then
    raise exception 'Solo el dueño puede ajustar una caja' using errcode = '42501';
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

  insert into public.caja_movimientos (caja_id, comercio_id, usuario_id, tipo, monto, motivo, es_ajuste)
  values (p_caja_id, v_comercio, v_uid, p_tipo, p_monto, v_motivo, true)
  returning id into v_id;

  return v_id;
end
$$;

revoke execute on function public.registrar_ajuste_caja(uuid, text, numeric, text)
  from public, anon;
grant execute on function public.registrar_ajuste_caja(uuid, text, numeric, text)
  to authenticated;

notify pgrst, 'reload schema';
