-- Fase 3: actualización masiva de precios por categoría (o todo el catálogo) con un porcentaje.
-- productos_costos (PR #5) va en la migración siguiente.
--
-- Un único UPDATE: se aplica a todos los productos o a ninguno. Es SECURITY INVOKER a propósito:
-- la RLS de productos (0006) y el GRANT por columna sobre `precio` siguen siendo la barrera real.
-- El chequeo de rol de abajo solo existe porque la RLS de UPDATE filtra en silencio (0 filas) en
-- vez de fallar, y el cajero tiene que recibir un error claro.
-- El precio nuevo se redondea a centavos; un redondeo comercial (a $10, a $50) sería configuración
-- por comercio y llega con la Fase 7.

create function public.actualizar_precios(p_categoria_id uuid, p_porcentaje numeric)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actualizados integer;
begin
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede cambiar precios' using errcode = '42501';
  end if;

  if p_porcentaje is null or p_porcentaje = 0 or p_porcentaje < -50 or p_porcentaje > 200 then
    raise exception 'Porcentaje inválido: %', p_porcentaje using errcode = 'PV007';
  end if;

  update public.productos
     set precio = round(precio * (1 + p_porcentaje / 100), 2)
   where comercio_id = public.current_comercio_id()
     and (p_categoria_id is null or categoria_id = p_categoria_id);

  get diagnostics v_actualizados = row_count;
  return v_actualizados;
end;
$$;

revoke execute on function public.actualizar_precios(uuid, numeric) from public, anon;
grant execute on function public.actualizar_precios(uuid, numeric) to authenticated;
