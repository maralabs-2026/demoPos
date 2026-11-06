-- Logo opcional por comercio. El archivo vive en Storage (bucket comercios), en
-- {comercio_id}/logo-{marca}.{ext}; la tabla guarda solo la ruta.
--
-- Lectura pública por URL, como las fotos de producto: un logo no es un dato sensible y se muestra
-- en cada pantalla. Subirlo, cambiarlo y quitarlo es solo del dueño, igual que el nombre.
-- Acepta PNG para no perder la transparencia de un logo, además de JPEG y WebP.

alter table public.comercios
  add column logo_path text,
  add constraint comercios_logo_path_propio
    check (logo_path is null or logo_path like id::text || '/%'),
  add constraint comercios_nombre_largo
    check (char_length(btrim(nombre)) between 1 and 60);

-- comercios usa GRANTs por columna (0006): el nombre ya se puede actualizar; falta el logo.
-- La política comercios_update ya limita la escritura al dueño de ese comercio.
grant update (logo_path) on public.comercios to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comercios', 'comercios', true, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- La URL pública no pasa por esta política: hace falta para que Storage permita borrar.
create policy comercios_logo_select on storage.objects for select to authenticated
  using (
    bucket_id = 'comercios'
    and (storage.foldername(name))[1] = public.current_comercio_id()::text
    and public.current_rol() = 'dueno'
  );
create policy comercios_logo_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comercios'
    and (storage.foldername(name))[1] = public.current_comercio_id()::text
    and public.current_rol() = 'dueno'
  );
create policy comercios_logo_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'comercios'
    and (storage.foldername(name))[1] = public.current_comercio_id()::text
    and public.current_rol() = 'dueno'
  );
