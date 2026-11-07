-- Bloque 3.1: códigos de barras internos para productos que vienen sin código (bazar, accesorios).
--
-- Formato EAN-13: "20" + número correlativo de 10 dígitos + dígito verificador. El prefijo 20-29 está
-- reservado por GS1 para uso interno de cada comercio, así que nunca coincide con un producto de
-- fábrica. El lector y la cámara lo leen como cualquier otro EAN-13.
--
-- El último número entregado vive en configuracion (clave codigo_interno_ultimo). La fila se bloquea
-- con FOR UPDATE: dos personas creando productos a la vez nunca reciben el mismo código. Si el
-- código ya lo tiene un producto (por ejemplo, cargado a mano o por CSV), se saltea. Un código que
-- se generó y no se usó (se canceló el popup) queda salteado: no hace falta reciclarlo.
--
--   PV023 no quedan códigos internos libres

create function public.siguiente_codigo_interno()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comercio uuid := public.current_comercio_id();
  v_ultimo bigint;
  v_max_productos bigint;
  v_cuerpo text;
  v_suma int;
  v_codigo text;
begin
  if v_comercio is null or public.current_rol() is null
     or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede crear productos' using errcode = '42501';
  end if;

  insert into public.configuracion (comercio_id, clave, valor)
  values (v_comercio, 'codigo_interno_ultimo', '0')
  on conflict (comercio_id, clave) do nothing;

  select case when jsonb_typeof(valor) = 'number' then (valor #>> '{}')::numeric::bigint else 0 end
    into v_ultimo
    from public.configuracion
   where comercio_id = v_comercio and clave = 'codigo_interno_ultimo'
     for update;

  -- Arranca después del mayor código interno ya cargado, aunque el contador esté atrás.
  select coalesce(max(substr(codigo_barras, 3, 10)::bigint), 0)
    into v_max_productos
    from public.productos
   where comercio_id = v_comercio and codigo_barras ~ '^20[0-9]{11}$';
  v_ultimo := greatest(coalesce(v_ultimo, 0), v_max_productos);

  loop
    v_ultimo := v_ultimo + 1;
    if v_ultimo > 9999999999 then
      raise exception 'No quedan códigos internos libres' using errcode = 'PV023';
    end if;
    v_cuerpo := '20' || lpad(v_ultimo::text, 10, '0');
    v_suma := 0;
    for i in 1..12 loop
      v_suma := v_suma + substr(v_cuerpo, i, 1)::int * (case when i % 2 = 0 then 3 else 1 end);
    end loop;
    v_codigo := v_cuerpo || ((10 - v_suma % 10) % 10)::text;
    exit when not exists (
      select 1 from public.productos where comercio_id = v_comercio and codigo_barras = v_codigo
    );
  end loop;

  update public.configuracion
     set valor = to_jsonb(v_ultimo), updated_at = now()
   where comercio_id = v_comercio and clave = 'codigo_interno_ultimo';

  return v_codigo;
end
$$;

revoke execute on function public.siguiente_codigo_interno() from public, anon;
grant execute on function public.siguiente_codigo_interno() to authenticated;
