-- Fase 1: RLS definitiva. Regla base: un usuario solo ve filas de su comercio
-- (public.current_comercio_id()). Sobre eso, el rol acota qué puede escribir:
--   dueno     -> todo
--   encargado -> todo menos configuración (comercios, categorías, medios de pago, configuracion)
--                y menos eliminar usuarios / crear dueños
--   cajero    -> vender, ver productos, abrir/cerrar su propia caja
-- Nota de diseño: además de RLS se usan GRANTs por columna, de modo que ni siquiera un rol con
-- permiso de UPDATE puede tocar productos.stock_actual (solo lo modifica el trigger).

-- ---------------------------------------------------------------------------------------------
-- Privilegios base: por defecto nadie tiene nada. Cada tabla nueva requiere GRANT explícito
-- (además de RLS + políticas). Esto aplica también a tablas futuras creadas por migraciones.
-- ---------------------------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- TODO(demo): lectura anónima para /vender y /productos sin login. Se elimina en Fase 2
-- (junto con las políticas demo_anon_read_*) cuando exista autenticación.
grant select on public.comercios, public.categorias, public.productos, public.medios_pago to anon;

-- La demo escribía stock con un UPDATE anónimo; lo reemplaza la función registrar_venta (0007).
drop policy demo_anon_update_stock_productos on public.productos;

grant select on public.comercios to authenticated;
grant update (nombre) on public.comercios to authenticated;

grant select, delete on public.perfiles to authenticated;
grant insert (id, comercio_id, rol, nombre, activo) on public.perfiles to authenticated;
grant update (nombre, rol, activo) on public.perfiles to authenticated;

grant select, insert, update, delete on public.configuracion to authenticated;
grant select, insert, update, delete on public.categorias to authenticated;
grant select, insert, update, delete on public.medios_pago to authenticated;

grant select, delete on public.productos to authenticated;
grant insert (comercio_id, categoria_id, nombre, codigo_barras, precio, unidad_venta, stock_minimo)
  on public.productos to authenticated;
grant update (categoria_id, nombre, codigo_barras, precio, unidad_venta, stock_minimo)
  on public.productos to authenticated;

grant select on public.cajas to authenticated;
grant insert (comercio_id, usuario_id, monto_inicial) on public.cajas to authenticated;
grant update (estado, cerrada_at) on public.cajas to authenticated;

grant select on public.movimientos_stock to authenticated;
grant insert (comercio_id, producto_id, tipo, cantidad, motivo, usuario_id)
  on public.movimientos_stock to authenticated;

-- Solo lectura: se escriben únicamente desde registrar_venta.
grant select on public.ventas, public.venta_items, public.venta_pagos to authenticated;
grant select on public.caja_totales to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------------------------

-- comercios
create policy comercios_select on public.comercios for select to authenticated
  using (id = public.current_comercio_id());
create policy comercios_update on public.comercios for update to authenticated
  using (id = public.current_comercio_id() and public.current_rol() = 'dueno')
  with check (id = public.current_comercio_id());

-- perfiles: cada uno ve el suyo; dueño y encargado ven todos los de su comercio.
create policy perfiles_select on public.perfiles for select to authenticated
  using (
    id = auth.uid()
    or (comercio_id = public.current_comercio_id()
        and public.current_rol() in ('dueno', 'encargado'))
  );
create policy perfiles_insert on public.perfiles for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and (public.current_rol() = 'dueno'
         or (public.current_rol() = 'encargado' and rol <> 'dueno'))
  );
create policy perfiles_update on public.perfiles for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and (public.current_rol() = 'dueno'
         or (public.current_rol() = 'encargado' and rol <> 'dueno'))
  )
  with check (
    comercio_id = public.current_comercio_id()
    and (public.current_rol() = 'dueno' or rol <> 'dueno')
  );
create policy perfiles_delete on public.perfiles for delete to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() = 'dueno'
    and id <> auth.uid()
  );

-- configuracion, categorias, medios_pago: todos leen; solo el dueño escribe (es "configuración").
create policy configuracion_select on public.configuracion for select to authenticated
  using (comercio_id = public.current_comercio_id());
create policy configuracion_write on public.configuracion for all to authenticated
  using (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno')
  with check (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno');

create policy categorias_select on public.categorias for select to authenticated
  using (comercio_id = public.current_comercio_id());
create policy categorias_write on public.categorias for all to authenticated
  using (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno')
  with check (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno');

create policy medios_pago_select on public.medios_pago for select to authenticated
  using (comercio_id = public.current_comercio_id());
create policy medios_pago_write on public.medios_pago for all to authenticated
  using (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno')
  with check (comercio_id = public.current_comercio_id() and public.current_rol() = 'dueno');

-- productos: todos leen; dueño y encargado escriben (sin stock_actual: ver GRANTs).
-- Fase 3 agrega `costo`: hay que ocultárselo al cajero con GRANT por columna o una vista.
create policy productos_select on public.productos for select to authenticated
  using (comercio_id = public.current_comercio_id());
create policy productos_insert on public.productos for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy productos_update on public.productos for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  )
  with check (comercio_id = public.current_comercio_id());
create policy productos_delete on public.productos for delete to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );

-- cajas: cada usuario abre/cierra la suya; dueño y encargado ven todas.
create policy cajas_select on public.cajas for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and (usuario_id = auth.uid() or public.current_rol() in ('dueno', 'encargado'))
  );
create policy cajas_insert on public.cajas for insert to authenticated
  with check (comercio_id = public.current_comercio_id() and usuario_id = auth.uid());
create policy cajas_update on public.cajas for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and usuario_id = auth.uid()
    and estado = 'abierta'
  )
  with check (comercio_id = public.current_comercio_id() and usuario_id = auth.uid());

-- movimientos_stock: dueño y encargado leen y cargan ingresos/ajustes manuales.
-- Los movimientos de venta los inserta registrar_venta.
create policy movimientos_stock_select on public.movimientos_stock for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy movimientos_stock_insert on public.movimientos_stock for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and public.current_rol() in ('dueno', 'encargado')
    and tipo in ('ingreso', 'ajuste')
    and usuario_id = auth.uid()
  );

-- ventas: el cajero ve las suyas; dueño y encargado, todas las del comercio.
create policy ventas_select on public.ventas for select to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and (usuario_id = auth.uid() or public.current_rol() in ('dueno', 'encargado'))
  );
-- Ítems y pagos heredan la visibilidad de su venta (el EXISTS respeta la RLS de ventas).
create policy venta_items_select on public.venta_items for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_items.venta_id));
create policy venta_pagos_select on public.venta_pagos for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_pagos.venta_id));
