-- Foto opcional por producto. El archivo vive en Storage (bucket productos), en
-- {comercio_id}/{producto_id}/{archivo}; la tabla guarda solo la ruta.
--
-- Lectura pública por URL: una foto de producto no es un dato sensible, y una URL firmada sumaría
-- demora en la pantalla de cobro. Escribir queda para dueño y encargado de ese comercio.

alter table public.productos
  add column foto_path text,
  add constraint productos_foto_path_comercio
    check (foto_path is null or foto_path like comercio_id::text || '/%');

-- productos usa GRANTs por columna (0006): sin esto, nadie podría guardar la foto.
grant update (foto_path) on public.productos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 524288, array['image/jpeg'])
on conflict (id) do nothing;

-- La URL pública no pasa por esta política: hace falta para que Storage permita borrar.
create policy productos_foto_select on storage.objects for select to authenticated
  using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = public.current_comercio_id()::text
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy productos_foto_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = public.current_comercio_id()::text
    and public.current_rol() in ('dueno', 'encargado')
  );
create policy productos_foto_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'productos'
    and (storage.foldername(name))[1] = public.current_comercio_id()::text
    and public.current_rol() in ('dueno', 'encargado')
  );
