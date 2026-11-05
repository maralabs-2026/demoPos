-- Fase 7a: administración de usuarios.
--
-- Roles fijos: el rol define lo que cada uno puede hacer. El dueño administra a todos; el encargado,
-- solo a los cajeros. Nadie se modifica a sí mismo: así un comercio nunca se queda sin dueño activo,
-- porque quien cambia a otro dueño sigue siéndolo.
--
-- Un usuario no se borra, se desactiva: sus ventas y cajas tienen que seguir apuntando a él.
--
--   42501 sin permiso

drop policy perfiles_insert on public.perfiles;
create policy perfiles_insert on public.perfiles for insert to authenticated
  with check (
    comercio_id = public.current_comercio_id()
    and (public.current_rol() = 'dueno'
         or (public.current_rol() = 'encargado' and rol = 'cajero'))
  );

drop policy perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles for update to authenticated
  using (
    comercio_id = public.current_comercio_id()
    and id <> auth.uid()
    and (public.current_rol() = 'dueno'
         or (public.current_rol() = 'encargado' and rol = 'cajero'))
  )
  with check (
    comercio_id = public.current_comercio_id()
    and (public.current_rol() = 'dueno' or rol = 'cajero')
  );

drop policy perfiles_delete on public.perfiles;
revoke delete on public.perfiles from authenticated;

-- Misma regla que perfiles_update, para lo que se hace con la service role sobre auth.users
-- (blanquear la contraseña, bloquear el ingreso), donde la RLS no alcanza.
create function public.puede_administrar_usuario(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles t
     where t.id = p_usuario_id
       and t.comercio_id = public.current_comercio_id()
       and t.id <> auth.uid()
       and (public.current_rol() = 'dueno'
            or (public.current_rol() = 'encargado' and t.rol = 'cajero'))
  )
$$;

revoke execute on function public.puede_administrar_usuario(uuid) from public, anon;
grant execute on function public.puede_administrar_usuario(uuid) to authenticated;

-- Los usuarios del comercio con su correo, que vive en auth.users. Filtra por comercio acá: la
-- alternativa, listar auth.users con la service role, traería a los de todos los comercios.
create function public.listar_usuarios()
returns table (
  id uuid,
  nombre text,
  rol public.rol_usuario,
  activo boolean,
  email text,
  contrasena_temporal boolean,
  administrable boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_rol() is null or public.current_rol() not in ('dueno', 'encargado') then
    raise exception 'No tenés permiso para ver los usuarios' using errcode = '42501';
  end if;

  return query
    select p.id, p.nombre, p.rol, p.activo, u.email::text,
           coalesce((u.raw_app_meta_data ->> 'must_change_password')::boolean, false),
           public.puede_administrar_usuario(p.id)
      from public.perfiles p
      join auth.users u on u.id = p.id
     where p.comercio_id = public.current_comercio_id()
     order by p.activo desc, p.nombre;
end
$$;

revoke execute on function public.listar_usuarios() from public, anon;
grant execute on function public.listar_usuarios() to authenticated;

notify pgrst, 'reload schema';
