# Plan: Auth Backend Fase 2

## Archivos a crear o tocar (10 líneas o menos)

1. `src/middleware.ts` (nuevo) — refresh de sesión `@supabase/ssr` en cada request.
2. `src/modules/auth/queries.ts` (nuevo) — `getAuthProfile()`: rol, `comercio_id`, nombre y nombre del comercio desde `public.perfiles` + `comercios` bajo RLS.
3. `src/modules/auth/session.ts` (nuevo) — tipo `SessionProfile` (`email`, `rol`, `comercio_id`, `nombre`, `comercio`, `must_change_password`) y lectura de `must_change_password` desde `user.metadata`.
4. `src/modules/auth/session-guard.ts` — re-tipar contra `SessionProfile`; adiós a `MockSession`.
5. `src/modules/auth/components/{app-shell,navigation,profile}.tsx` — reciben `SessionProfile` por props; cero `getMockSession()`.
6. `src/modules/auth/components/{login-form,change-password-form}.tsx`, `src/app/login/login-view.tsx`, `src/app/cambiar-contrasena/change-password-view.tsx` — sign-in / sign-out / cambio de contraseña reales.
7. `src/app/(app)/layout.tsx` — resuelve sesión con `getUser()` y la pasa como props.
8. `src/modules/auth/index.ts` — exports nuevos; se sacan los del mock.
9. `src/modules/auth/mock.ts` y `mock.test.ts` — se eliminan.
10. `supabase/migrations/0008_*.sql` (nuevo) — retira acceso `anon`; **se escribe, no se aplica** en esta etapa.

Sin tocar: productos, ventas, cajas, `design/auth.pen`, migraciones `0001`–`0007`, `package.json` (no hay dependencias nuevas).

## Decisiones técnicas

- **Sesión server-side:** `(app)/layout.tsx` usa `supabase.auth.getUser()` (server client) y resuelve el perfil con `getAuthProfile()`; AppShell y navegación reciben `SessionProfile` como props. Nada se lee de `sessionStorage` (CA3).
- **Login (CA1, R1):** `signInWithPassword` con el browser client (`src/lib/supabase/client.ts`); tras éxito `router.refresh()` para que el servidor relea cookies. Usuario inexistente y contraseña incorrecta muestran exactamente el mismo mensaje: "Correo o contraseña incorrectos" (requisito de la guía). Los errores de red/servidor conservan el comportamiento existente de la UI (mensaje aparte "No se pudo conectar..."), ya que la guía no exige convertirlos al mensaje genérico de credenciales.
- **Cambio de contraseña (R4):** `updateUser({ password, data: { must_change_password: false } })`; el formulario deja de pedir email y contraseña actual (nunca estuvieron del lado cliente), solo nueva + confirmación.
- **Guard (R4, CA4):** `session-guard.ts` evalúa `SessionProfile.must_change_password` proveniente de `user.metadata`.
- **Middleware (CA2):** patrón `@supabase/ssr` (`getAll`/`setAll` de cookies + `getUser()`) con `config.matcher` excluyendo `/_next/*`, imagen y favicon.
- **Migración 0008 (R6, CA6):** `drop policy` de las 4 `demo_anon_read_*` + `revoke select ... from anon`. Solo se planifica y escribe el archivo; la aplicación va en una tarea de verificación contra la base de test/dev, nunca contra la compartida.

## Estrategia de tests (convivencia temporal)

- **`mock.test.ts` + `mock.ts`:** se eliminan (CA7). Su lógica muere con el mock.
- **`session-guard.test.ts`:** se reescribe con **fixtures locales** en el propio archivo (objetos `SessionProfile`), sin importar del módulo de producción.
- **Unit restantes** (`schemas`, `next-route`, `navigation`, `brand`): no dependen de `mock.ts`; sin cambios.
- **`e2e/change-password-guard.spec.ts`:** se reescribe para trabajar con **autenticación real de Supabase** a través de la UI, sin sembrar `sessionStorage`. Objetivo definitivo: que `npm run test:e2e` se ejecute sin errores contra el login real.
  - Se utilizan exclusivamente los **usuarios de prueba de Supabase** generados por `supabase/seed_dev_users.sql` (nunca datos reales del kiosco), con contraseña por **env var no versionada**. Ver "Provisión de usuarios de prueba" más abajo.
  - Casos: login del usuario con flag → `/cambiar-contrasena`; login de un usuario de prueba sin flag → `/vender` normal; cierre de sesión → `/login`.
  - Meta final: `npm run test` y `npm run test:e2e` terminan en verde, siempre con usuario de prueba, nunca con datos reales (R8).

## Provisión de usuarios de prueba (decisión confirmada por Jordy)

- Los usuarios de prueba se provisionan **con el seed existente** `supabase/seed_dev_users.sql`. No se crean usuarios ad-hoc.
- El seed genera los tres usuarios de prueba ya definidos: `dueno@kiosko.demo`, `encargado@kiosko.demo` y `cajero@kiosko.demo`.
- Esos usuarios quedan vinculados a `public.perfiles` y al comercio "Kiosko Demo", y sirven para verificar **CA3 y CA5**: roles, `current_rol()`, `current_comercio_id()` y navegación según rol.
- **Prerrequisito:** antes de correr `seed_dev_users.sql` debe existir el seed base con el comercio "Kiosko Demo".
- **CA4:** tras el seed, `raw_user_meta_data` queda vacío (`{}`). Hay que setear manualmente `{"must_change_password": true}` desde Supabase Auth → Users → metadata en **al menos uno** de esos tres usuarios.
- No se crea un cuarto usuario ni se modifican los UUID fijos del seed sin consultar antes a Jordy.
- Las contraseñas de los usuarios de prueba son exclusivamente de prueba: se pasan por variables de `psql` / variables de entorno y **no se versionan ni se escriben** en `plan.md`, `spec.md`, código o commits.

## Riesgos

- Aplicar `0008` en la base de la demo antes de tener login operativo rompe `/vender` y `/productos` sin sesión → aplicar solo en la verificación de CA6 sobre base de prueba.
- Variabilidad de errores de Supabase (rate limits, confirmación de email) → mapeo acotado y testeado.
- e2e depende de que el seed base y `seed_dev_users.sql` estén cargados en la base que usa Playwright; si falta, falla → se resuelve corriendo los seeds, siempre con usuarios de prueba, nunca con datos reales.
- El flag `must_change_password` se setea a mano después del seed: si se olvida en el usuario que se usa para CA4, esa verificación falla.

## Cómo se verifica

- `npm run test`, `npm run lint`, `npm run build` y `npm run test:e2e` en verde.
- CA1–CA5: login real con los **usuarios de prueba de Supabase** del seed, borrado de `sessionStorage`, refresh, navegación por rol y perfil.
- CA6: aplicar `0008` en base de prueba; `set role anon; select * from productos;` → `permission denied`.
