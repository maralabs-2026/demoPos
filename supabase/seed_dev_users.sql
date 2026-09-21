-- Usuarios de prueba (uno por rol) para desarrollo y tests de permisos.
-- NO lleva contraseñas: se pasan por variables de psql y no se versionan.
--
--   psql "<connection-string>" -v ON_ERROR_STOP=1 \
--        -v dueno_pw='...' -v encargado_pw='...' -v cajero_pw='...' \
--        -f supabase/seed_dev_users.sql
--
-- Requiere que el seed base ya esté cargado (comercio 'Kiosko Demo'). Los UUID son fijos para
-- que los tests puedan referenciarlos; si ya existen, el script falla en lugar de duplicar.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000d1',
   'authenticated', 'authenticated', 'dueno@kiosko.demo',
   extensions.crypt(:'dueno_pw', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2',
   'authenticated', 'authenticated', 'encargado@kiosko.demo',
   extensions.crypt(:'encargado_pw', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000c3',
   'authenticated', 'authenticated', 'cajero@kiosko.demo',
   extensions.crypt(:'cajero_pw', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', u.id::text, now(), now(), now()
from auth.users u
where u.email in ('dueno@kiosko.demo', 'encargado@kiosko.demo', 'cajero@kiosko.demo');

insert into public.perfiles (id, comercio_id, rol, nombre)
select v.id::uuid, co.id, v.rol::public.rol_usuario, v.nombre
from public.comercios co, (values
  ('00000000-0000-4000-8000-0000000000d1', 'dueno', 'Dueño Demo'),
  ('00000000-0000-4000-8000-0000000000e2', 'encargado', 'Encargado Demo'),
  ('00000000-0000-4000-8000-0000000000c3', 'cajero', 'Cajero Demo')
) as v(id, rol, nombre)
where co.nombre = 'Kiosko Demo';
