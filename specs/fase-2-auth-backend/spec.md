# Spec: Auth Backend Fase 2 (Fase 2)

## Contexto

La Fase 2 UI (`specs/fase-2-auth-ui/`) quedó lista con sesión y datos de prueba en `src/modules/auth/mock.ts` marcados con `TODO(fase-2)`. CLAUDE.md Fase 2 exige autenticación real de Supabase Auth: login con email y contraseña, mensajes de error genéricos, navegación por rol, perfil de solo lectura, blanqueo de contraseña solo por dueño/encargado (Fase 7) y eliminación de la política RLS temporal de la demo. Esta spec reemplaza el mock por Supabase Auth real.

La guía de Fase 2 Backend, provista por Jordy, es la autoridad para esta tarea. **No** se asume traer ni mergear la rama `docs/fase-2-auth-backend`: no ejecutar `git merge`, `checkout` ni `cherry-pick` de esa rama; la guía se toma directamente como insumo.

## Objetivo

Conectar login, sesión y perfil a Supabase Auth respetando el patrón `@supabase/ssr` ya esbozado en `src/lib/supabase/`, quitar el acceso anónimo de la demo mediante una migración nueva y eliminar el mock de la ruta de producción.

## Fuera de alcance

- No implementar recuperación de contraseña por autoservicio.
- No implementar la pantalla de administración de usuarios ni el blanqueo de contraseña desde la app (es Fase 7; el blanqueo sigue desde el panel de Supabase).
- No modificar productos, ventas ni cajas (solo se elimina el acceso `anon`, que es seguridad).
- No modificar migraciones `0001` a `0007`.
- No implementar nuevas pantallas (se adaptan las existentes de `/login`, `/cambiar-contrasena` y `/perfil` y el layout `(app)`).
- No cambiar `design/auth.pen` ni crear diseños nuevos (tarea backend pura).
- No agregar columnas ni lógica de stock/flags en la base además de la migración `0008`.

## Requisitos

- R1. Login real con `supabase.auth.signInWithPassword` usando el browser client (`src/lib/supabase/client.ts`), patrón `@supabase/ssr`; tras el sign-in el servidor vuelve a leer la sesión (p. ej. `router.refresh()`), de modo que cookies y RLS coincidan en el siguiente render.
- R2. El middleware `src/middleware.ts` refresca la sesión en cada request usando el patrón `@supabase/ssr` documentado (cliente de server-only, `getAll`/`setAll` de cookies, `supabase.auth.getUser()`). Esto cumple el comentario de `src/lib/supabase/server.ts`: a los Server Components las cookies les llegan read-only y "Session refresh is handled by middleware".
- R3. `rol`, `comercio_id` y `nombre` se leen de `public.perfiles` (una query a `perfiles` filtrada por `id = auth.uid()`, que la política `perfiles_select` permite). Las funciones `current_rol()` / `current_comercio_id()` de `0003` son la fuente de verdad para RLS en la base y se pueden reutilizar como validación, pero la app obtiene el perfil completo desde la tabla.
- R4. El flag de cambio obligatorio de contraseña se lee de `user.metadata.must_change_password` de Supabase Auth (en `user_metadata` / `raw_user_meta_data`). Se limpia al terminar el cambio con `supabase.auth.updateUser({ password, data: { must_change_password: false } })`. No se agrega columna.
- R5. `AppShell`, `session-guard.ts`, `navigation.tsx` y `profile.tsx` trabajan con la sesión real (perfil + metadata) y no con `getMockSession()`.
- R6. Migración nueva `supabase/migrations/0008_*.sql` que elimina el acceso `anon` de la demo:
  - `drop policy` de `demo_anon_read_comercios` (0001), `demo_anon_read_categorias`, `demo_anon_read_productos`, `demo_anon_read_medios_pago` (0002).
  - `revoke select on public.comercios, public.categorias, public.productos, public.medios_pago from anon` (revierte el `grant` de `0006:20`).
  - Sin tocar `0001`...`0007`.
- R7. `src/modules/auth/mock.ts` se elimina. Su lógica de sesión y autenticación deja de existir en producción y su suite (`mock.test.ts`) se borra. La estrategia de tests se detalla en "Tests que dependen de mocks".
- R8. La prueba final del login real se hace exclusivamente con un usuario de prueba creado en Supabase para tests (p. ej. `cajero@kiosko.demo`), **nunca con datos reales del kiosco ni de sus usuarios**. Regla: ninguna credencial, correo o dato real de producción se usa en verificación, e2e ni fixtures.

## Criterios de aceptación (verificables)

- [x] CA1. Login con `supabase.auth.signInWithPassword`. Correo inexistente y contraseña incorrecta muestran ambos el mismo error: "Correo o contraseña incorrectos". (Se verifica con el usuario `cajero@kiosko.demo` y una contraseña errónea, y con un correo no existente.)
  - Verificado (2026-10-02) con `e2e/login-error-message.spec.ts`: 5/5 e2e en verde contra Supabase real. Con `dueno@kiosko.demo` y contraseña derivada + `no-existe@kiosko.demo` ambos muestran exactamente "Correo o contraseña incorrectos".
- [x] CA2. `src/middleware.ts` refleja el patrón `@supabase/ssr` (refresco de sesión por request) con `config.matcher` que excluye `/_next/*`, imagen y favicon. Sin middleware, la sesión expira al refrescar; con middleware, un refresh de `/perfil` mantiene la sesión.
  - Verificado (2026-10-08) con usuario real de Supabase: sesión iniciada, ingreso a `/perfil`, refresh de página, sesión activa y datos del perfil visibles. Detalle en el estado de `tasks.md`.
- [x] CA3. `rol`, `comercio_id` y `nombre` salen de `public.perfiles`. Un usuario autenticado que borra su `sessionStorage` sigue viendo su rol y comercio correctos en `/perfil` (verifica que nada del perfil proviene de `sessionStorage`).
  - Verificado (2026-10-08): en DevTools > Application > Session storage > `http://localhost:3000` la tabla estaba vacía; tras refrescar `/perfil` la sesión siguió activa y el perfil mostró Nombre: Dueño Demo, Rol: DUEÑO, Comercio: Kiosko Demo.
- [x] CA4. `must_change_password` sale de `user_metadata`. Con un usuario seed cuyo `raw_user_meta_data` tenga `{"must_change_password": true}`: tras el login es redirigido a `/cambiar-contrasena`, y una vez cambiada la contraseña la metadata queda en `false` (verificar en base).
  - Verificado (2026-10-08): usuario cajero con `must_change_password: true` fue enviado a `/cambiar-contrasena` tras el login; al cambiar la contraseña fue enviado a `/vender` y en Supabase Authentication la metadata quedó en `false`. Sin contraseñas en esta documentación.
- [x] CA5. `AppShell`, `session-guard.ts`, `navigation.tsx` y `profile.tsx` no contienen referencias a `getMockSession()` / `storeMockSession()` / `clearMockSession()`. La navegación muestra el menú del rol real y el perfil muestra nombre/rol/comercio reales.
  - Verificado (2026-10-08): con Dueño la navegación mostró las opciones de su rol y `/perfil` mostró Dueño Demo, DUEÑO y Kiosko Demo; con Cajero la navegación mostró Vender, Productos y Mi perfil, y `/perfil` mostró Cajero Demo, CAJERO y Kiosko Demo. Datos correspondientes a la sesión real.
- [x] CA6. `0008_*.sql` aplica limpio sobre la base actual y tras ella un `set role anon; select * from productos;` devuelve `permission denied` (antes devolvía filas). `0001`...`0007` no cambian.
  - Verificado (2026-10-07) en la base descartable `kiosko-demo-test`, nunca en la compartida: ANTES de `0008` `anon` leía 40 filas (`productos_visibles_anon = 40`, reproducción temporal terminada con `ROLLBACK`); DESPUÉS de aplicar `0008`, `select * from productos` devuelve `Failed to run sql query: ERROR: 42501 permission denied for table productos`, con HINT `GRANT SELECT ON public.productos TO anon`. Comprobaciones posteriores al `ROLLBACK`: `current_user` = postgres; `anon` sin grant sobre `public.productos` (0 filas); policy `demo_anon_read_productos` inexistente (0 filas). `git diff -- supabase/migrations` vacío, `0001`–`0008` sin cambios. Detalle de los pasos en T7 (`tasks.md`).
- [ ] CA7. `src/modules/auth/mock.ts` y `src/modules/auth/mock.test.ts` no existen. `npm run test`, `npm run lint` y `npm run build` pasan en verde.

## Cambios derivados de la sesión real (adaptación, no pantallas nuevas)

- `/login`: tras `signInWithPassword`, si `user.metadata.must_change_password` es `true` redirige a `/cambiar-contrasena`; si no, a la ruta `next` segura.
- `/cambiar-contrasena`: ya no se lee el email ni la contraseña actual del mock (la contraseña del usuario nunca debe estar en el cliente). El formulario pasa a pedir solo nueva contraseña + confirmación; el email sale del `user` autenticado. El flag se limpia vía `updateUser`.
- `/perfil` y navegación: obtienen email, rol, nombre y comercio del perfil real + sesión.
- Cierre de sesión: `supabase.auth.signOut()` (browser client) + `router.replace("/login")` + refresh del servidor.

## Tests que dependen de mocks

Estrategia (con una decisión pendiente señalada en e2e):

- `src/modules/auth/mock.ts` y `src/modules/auth/mock.test.ts`: **se eliminan**. Ya no hay lógica ni datos mock en la ruta de producción.
- `src/modules/auth/session-guard.ts`: deja de tipar `MockSession`; recibe el tipo de sesión real (perfil + `must_change_password`). Su test (`session-guard.test.ts`) se reescribe con **fixtures locales** en el propio archivo (objeto de usuario con `rol`, `email`, `nombre`, `comercio`, `must_change_password`), sin importar del módulo de producción.
- Los demás tests unitarios (`schemas.test.ts`, `next-route.test.ts`, `navigation.test.ts`, `brand.test.ts`): no dependen de `mock.ts` y se mantienen sin cambios.
- `e2e/change-password-guard.spec.ts`: no se puede sembrar `sessionStorage` mock con auth real. La guía de Fase 2 Backend pide que el **plan técnico** explique cómo convivirán temporalmente los tests actuales con la sesión real y que, al final, `npm run test:e2e` quede sin errores. Por eso **esta spec no decide** la estrategia concreta (login real con usuario de test, `test.skip` + `TODO`, u otra): queda **pendiente de definición y aprobación en el plan técnico**. Lo que sí se fija acá: se prueba solo con el usuario de prueba de Supabase (R8), nunca con datos reales, y el objetivo final es `npm run test:e2e` en verde. El guard de roles (`/reportes`, `/config`) que pide la validación de Fase 2 se cubre con los tests de Playwright que ya existan en la fase; si no existen, se agregan en la misma tarea e2e de esta fase.
- Regla general: ningún test importa datos o funciones del módulo de producción para construir fixtures de sesión; los fixtures viven dentro de cada archivo de test.

## Reglas del proyecto que aplican

- Módulos: todo el código Auth en `src/modules/auth/`; solo se importa por su `index.ts` público. El tipo `Rol` se mantiene en el módulo (fuente: `rol_usuario` de la base), no desde el mock.
- Errores: toda acción devuelve `{ ok: true, data } | { ok: false, error }`. El error de credenciales de Supabase ("Invalid login credentials", "Email not confirmed", etc.) se traduce a una única categoría con mensaje genérico.
- Validación Zod en cliente y servidor antes de llamar a la base (los schemas de login/cambio de contraseña de la fase UI se mantienen y se ajustan si cambia el formulario).
- Código en inglés (identificadores), textos de interfaz en español rioplatense (voseo).
- No instalar dependencias: `@supabase/ssr` y `@supabase/supabase-js` ya están en `package.json`; el middleware usa `@supabase/ssr`.
- Todo lo nuevo respeta multi-tenant: los datos del usuario provienen de `perfiles` bajo RLS, nunca de storage del navegador.
- Los tipos generados de Supabase (`supabase gen types`) siguen siendo la fuente para las tablas; hasta regenerarlos, se usan `overrideTypes` como ya hace `config/queries.ts`.

## Preguntas abiertas

- **Estrategia definitiva de `e2e/change-password-guard.spec.ts`**: queda **pendiente de definición/aprobación en el plan técnico** (login real con usuario de prueba de Supabase vs `test.skip` + `TODO`, respetando R8 y que `npm run test:e2e` termine sin errores). No es una decisión de esta spec.
- ¿El usuario de test con `must_change_password: true` se agrega al seed de desarrollo (`supabase/seed_dev_users.sql`, fuera de migraciones) o se crea ad-hoc solo para e2e? (Jordy decide dónde vive el dato.)
- El mensaje de error de red/Servidor ("No se pudo conectar...") de la fase UI se conserva o se unifica con el genérico de credenciales. (Decisión: la migración de CA1 solo garantiza el mensaje genérico para credenciales; el resto se revisa en el plan.)