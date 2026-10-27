-- Fase 3: importación de productos desde CSV.
--
-- Toda la importación es una sola transacción: entran todas las filas o ninguna. La vista previa
-- del cliente ya descarta las filas inválidas; esta función vuelve a validar porque es la barrera
-- real (el cliente puede mandar cualquier cosa).
--
-- Decisiones (Jordy, 26/10):
-- - Un producto que ya existe (mismo codigo_barras en el comercio) se ACTUALIZA con los datos del
--   archivo, para que el CSV sirva también como lista de precios del proveedor.
-- - Una categoría que no existe RECHAZA la fila: las categorías se administran en Configuración
--   (Fase 7) y un error de tipeo no debe crear una categoría duplicada. Se compara sin distinguir
--   mayúsculas ni espacios en los extremos, pero sí tildes ("Almacen" no es "Almacén").
-- - Una celda opcional vacía (categoría o costo) en un producto existente NO borra el dato
--   cargado: en una planilla, vacío significa "no lo sé", no "borralo". Para borrar un costo está
--   el formulario del ABM.
-- - stock_actual no se importa: el stock se mueve solo con movimientos (ingreso de mercadería).
--
-- SECURITY INVOKER, como guardar_producto (0010): la RLS de productos, categorias y
-- productos_costos sigue siendo la barrera.
--
-- p_productos es un array JSON de objetos con: nombre, codigo_barras, categoria (nombre o null),
-- precio, costo (o null), unidad_venta, stock_minimo. Devuelve {"creados": n, "actualizados": m}.
-- Ante una fila inválida falla con PV010 y el número de elemento (desde 1) en DETAIL.

create function public.importar_productos(p_productos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_comercio_id uuid := public.current_comercio_id();
  v_total integer;
  v_fila jsonb;
  v_i integer := 0;
  v_nombre text;
  v_codigo text;
  v_categoria_nombre text;
  v_categoria_id uuid;
  v_precio numeric;
  v_costo numeric;
  v_unidad text;
  v_stock_minimo integer;
  v_id uuid;
  v_creado boolean;
  v_creados integer := 0;
  v_actualizados integer := 0;
begin
  -- La RLS de INSERT/UPDATE filtra en silencio o falla con un error genérico; el chequeo
  -- explícito da un error claro al cajero.
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'Tu rol no puede importar productos' using errcode = '42501';
  end if;

  if p_productos is null or jsonb_typeof(p_productos) <> 'array' then
    raise exception 'La importación no tiene productos' using errcode = 'PV010';
  end if;
  v_total := jsonb_array_length(p_productos);
  -- Mismo tope que CSV_MAX_FILAS en productos/schemas.ts.
  if v_total = 0 or v_total > 1000 then
    raise exception 'La importación debe tener entre 1 y 1000 productos' using errcode = 'PV010';
  end if;

  -- Un código repetido haría que la segunda fila pise a la primera sin aviso. Los códigos vacíos
  -- no cuentan acá: los rechaza la validación de cada fila con su número.
  if exists (
    select 1 from jsonb_array_elements(p_productos) e
     where nullif(trim(e ->> 'codigo_barras'), '') is not null
     group by trim(e ->> 'codigo_barras')
    having count(*) > 1
  ) then
    raise exception 'Hay códigos de barras repetidos en el archivo' using errcode = 'PV010';
  end if;

  for v_fila in select value from jsonb_array_elements(p_productos) loop
    v_i := v_i + 1;

    v_nombre := nullif(trim(v_fila ->> 'nombre'), '');
    v_codigo := nullif(trim(v_fila ->> 'codigo_barras'), '');
    v_categoria_nombre := nullif(trim(v_fila ->> 'categoria'), '');
    v_unidad := nullif(trim(v_fila ->> 'unidad_venta'), '');
    begin
      v_precio := (v_fila ->> 'precio')::numeric;
      v_costo := (v_fila ->> 'costo')::numeric;
      v_stock_minimo := (v_fila ->> 'stock_minimo')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Hay un número inválido en el producto %', v_i
        using errcode = 'PV010', detail = v_i::text;
    end;

    if v_nombre is null or v_codigo is null or v_unidad is null
       or v_precio is null or v_precio < 0 or v_precio > 9999999999.99
       or (v_costo is not null and (v_costo < 0 or v_costo > 9999999999.99))
       or v_stock_minimo is null or v_stock_minimo < 0
       or v_precio <> round(v_precio, 2)
       or (v_costo is not null and v_costo <> round(v_costo, 2)) then
      raise exception 'Faltan datos o hay valores inválidos en el producto %', v_i
        using errcode = 'PV010', detail = v_i::text;
    end if;

    v_categoria_id := null;
    if v_categoria_nombre is not null then
      select id into v_categoria_id
        from public.categorias
       where comercio_id = v_comercio_id
         and lower(trim(nombre)) = lower(v_categoria_nombre)
       order by orden, created_at
       limit 1;
      if v_categoria_id is null then
        raise exception 'La categoría "%" no existe', v_categoria_nombre
          using errcode = 'PV008', detail = v_i::text;
      end if;
    end if;

    -- xmax = 0 solo en la fila recién insertada: distingue alta de actualización.
    insert into public.productos as p
      (comercio_id, categoria_id, nombre, codigo_barras, precio, unidad_venta, stock_minimo)
    values
      (v_comercio_id, v_categoria_id, v_nombre, v_codigo, v_precio, v_unidad, v_stock_minimo)
    on conflict (comercio_id, codigo_barras) do update
      set categoria_id = coalesce(excluded.categoria_id, p.categoria_id),
          nombre = excluded.nombre,
          precio = excluded.precio,
          unidad_venta = excluded.unidad_venta,
          stock_minimo = excluded.stock_minimo
    returning p.id, (p.xmax = 0) into v_id, v_creado;

    -- Con RLS, un ON CONFLICT sobre un producto que no se puede actualizar no devuelve fila.
    if v_id is null then
      raise exception 'No se pudo guardar el producto %', v_i
        using errcode = '42501', detail = v_i::text;
    end if;

    if v_costo is not null then
      insert into public.productos_costos (producto_id, comercio_id, costo)
      values (v_id, v_comercio_id, v_costo)
      on conflict (producto_id) do update
        set costo = excluded.costo, updated_at = now();
    end if;

    if v_creado then
      v_creados := v_creados + 1;
    else
      v_actualizados := v_actualizados + 1;
    end if;
  end loop;

  return jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados);
end;
$$;

revoke execute on function public.importar_productos(jsonb) from public, anon;
grant execute on function public.importar_productos(jsonb) to authenticated;
