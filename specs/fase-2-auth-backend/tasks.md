# Tareas: Auth Backend Fase 2

Contexto: la UI de Fase 2 ya está; esta fase reemplaza el mock por Supabase Auth real (`signInWithPassword`), agrega el middleware de refresco y retira el acceso `anon` de la demo. Orden dado por Jordy; cada tarea se implementa de a una y se verifica con `npm run test`, `npm run lint` y `npm run build`.

Reglas fijas: autenticación real con Supabase; usuarios de prueba exclusivamente desde `supabase/seed_dev_users.sql` (prohibido crear usuarios ad-hoc); contraseñas de prueba por variables de entorno, nunca versionadas; no agregar dependencias (`@supabase/ssr` y `@supabase/supabase-js` ya están); no tocar productos, ventas, cajas ni `design/auth.pen`; no modificar migraciones `0001`–`0007`; no modificar `spec.md` ni `plan.md`.

- [x] T1 Middleware de refresco de sesión en `src/middleware.ts` (nuevo): patrón `@supabase/ssr` (cliente server-only, `getAll`/`setAll` de cookies, `supabase.auth.getUser()`) en cada request, con `config.matcher` que excluye `/_next/*`, imagen y favicon. Cubre CA2 y R2. Hecho cuando: un refresh de `/perfil` mantiene la sesión, y `npm run build` y `npm run lint` pasan en verde.
- [x] T2 Login real con `supabase.auth.signInWithPassword` (browser client `src/lib/supabase/client.ts`): tras el éxito `router.refresh()` para que el servidor relea cookies; correo inexistente y contraseña incorrecta muestran el mismo mensaje "Correo o contraseña incorrectos"; los errores de red/servidor conservan su mensaje aparte; si `user.metadata.must_change_password` es `true` redirige a `/cambiar-contrasena`, si no a la ruta `next` segura. La verificación se hace solo con los usuarios del seed. Cubre CA1 y R1. Hecho cuando: con `cajero@kiosko.demo` y contraseña errónea, y con un correo inexistente, el mensaje es idéntico, y `npm run lint` y `npm run build` pasan en verde.
  - Verificado en ejecución (2026-10-02) con `e2e/login-error-message.spec.ts`: `npm run test:e2e` → 5 passed contra Supabase real. Desviación menor: el test usa `dueno@kiosko.demo` del seed en lugar de `cajero@kiosko.demo`; la contraseña errónea se deriva mutando el último carácter de `E2E_DUENO_PASSWORD` (nada hardcodeado) y el correo inexistente es `no-existe@kiosko.demo`. Los dos casos devuelven exactamente "Correo o contraseña incorrectos".
- [x] T3 Query de perfiles server-side: `src/modules/auth/queries.ts` (nuevo) con `getAuthProfile()` que lee `rol`, `comercio_id`, `nombre` y el nombre del comercio desde `public.perfiles` + `comercios` bajo RLS (`id = auth.uid()`), y `src/modules/auth/session.ts` (nuevo) con el tipo `SessionProfile` y la lectura de `must_change_password` desde `user.metadata`; `src/app/(app)/layout.tsx` resuelve la sesión con `getUser()` y la pasa como props a `AppShell` y navegación. Nada se lee de `sessionStorage`. Cubre CA3 y R3. Hecho cuando: un usuario autenticado borra su `sessionStorage` y sigue viendo su rol y comercio correctos en `/perfil`.
- [x] T4 Guard y flag de cambio obligatorio: `src/modules/auth/session-guard.ts` evalúa `SessionProfile.must_change_password` proveniente de `user.metadata` y `AppShell`, `navigation.tsx` y `profile.tsx` usan la sesión real (sin `getMockSession()`); `change-password-form` limpia el flag con `updateUser({ password, data: { must_change_password: false } })`, pidiendo solo nueva contraseña + confirmación; `session-guard.test.ts` se reescribe con fixtures locales en el propio archivo. Para CA4, tras el seed se setea manualmente `{"must_change_password": true}` en la metadata de uno de los usuarios del seed (Supabase Auth → Users → metadata); no se agrega columna. Cubre CA4, CA5, R4 y R5. Hecho cuando: el login de ese usuario redirige a `/cambiar-contrasena`, tras cambiarla la metadata queda en `false` (verificado en base) y no hay referencias a `getMockSession()` / `storeMockSession()` / `clearMockSession()`.
- [x] T5 Migración `supabase/migrations/0008_*.sql` (nueva): `drop policy` de `demo_anon_read_comercios`, `demo_anon_read_categorias`, `demo_anon_read_productos` y `demo_anon_read_medios_pago`, más `revoke select on public.comercios, public.categorias, public.productos, public.medios_pago from anon` (revierte el grant de `0006`). Solo se crea el archivo: **no aplicar la migración contra la base compartida en esta fase**; la aplicación se hace en la verificación de CA6 sobre una base de prueba. No se tocan `0001`–`0007`. Cubre CA6 y R6. Hecho cuando: el archivo existe y, en base de prueba, `set role anon; select * from productos;` devuelve `permission denied`.
  - Escritura y ejecución verificadas. `0008` se aplicó sobre la base descartable `kiosko-demo-test`, nunca sobre la compartida. Evidencia y pasos exactos en T7.
- [x] T6 Sacar el mock y actualizar sus tests: eliminar `src/modules/auth/mock.ts` y `src/modules/auth/mock.test.ts`, limpiar los exports del mock en `src/modules/auth/index.ts` y reescribir `e2e/change-password-guard.spec.ts` para operar con login real por la UI (sin sembrar `sessionStorage` mock), usando exclusivamente los usuarios de `supabase/seed_dev_users.sql` con contraseña por env var no versionada; casos: usuario con flag → `/cambiar-contrasena`, usuario sin flag → `/vender`, cierre de sesión → `/login`. Cubre CA7 (y cierra CA5, R7 y R8). Hecho cuando: `mock.ts` y `mock.test.ts` no existen y `npm run test`, `npm run lint`, `npm run build` y `npm run test:e2e` pasan en verde.
- [x] T7 Verificar CA6 en ejecución, en base descartable y **nunca contra la compartida**. Hecho (2026-10-07) sobre el proyecto Supabase descartable `kiosko-demo-test`, elegido en lugar de Supabase local con Docker. Evidencia:
  - Entorno recreado en `kiosko-demo-test` con estos archivos, en este orden, desde el SQL Editor (un Run por archivo): `0001` → `0002` → `0003` → `0004` → `supabase/seed.sql` → `0005` → `0006` → `0007`. `seed.sql` va entre 0004 y 0005 porque usa `configuracion` (0003) y `movimientos_stock` (0004); `0006` es el que concede `grant select ... to anon` (línea 20). `seed_dev_users.sql` no se corrió: no hace falta para CA6 y necesita variables de psql.
  - ANTES de `0008`, en el SQL Editor (reproducción temporal dentro de una transacción):

    ```
    set role anon;
    select count(*) as productos_visibles_anon from public.productos;
    ```

    Resultado:

    ```
    productos_visibles_anon
    40
    ```

    La reproducción temporal terminó con ROLLBACK.

  - Se aplicó `0008_remove_demo_anon_access.sql` completo.
  - DESPUÉS de `0008`, en el SQL Editor:

    ```
    set role anon;
    select * from public.productos;
    ```

    Resultado:

    ```
    Failed to run sql query: ERROR:  42501: permission denied for table productos
    HINT:  Grant the required privileges to the current role with: GRANT SELECT ON public.productos TO anon;
    ```

  - Comprobaciones posteriores al ROLLBACK:
    - `current_user` = postgres
    - `anon` no tiene `grant SELECT` sobre `public.productos`: 0 filas
    - no existe la policy `demo_anon_read_productos`: 0 filas
  - `0001`–`0008` no cambiaron: `git diff -- supabase/migrations` vacío. La base compartida `kiosko-demo` no se tocó.
  - Diferencia menor contra la base compartida, sin efecto en CA6: los movimientos de stock inicial quedan con `motivo = 'Stock inicial'` (del seed) en vez de `'Stock inicial (migración)'` (de 0004), porque el seed corrió con `productos` ya vacía.

## Estado de verificación (2026-10-08)

| CA | Estado | Evidencia / qué falta |
| --- | --- | --- |
| CA1 | **Verificado en ejecución** | `npm run test:e2e` → 5 passed contra Supabase real; `e2e/login-error-message.spec.ts` prueba los dos casos con el mismo mensaje |
| CA2 | **Verificado en ejecución** | Con usuario real de Supabase: login, `/perfil`, refresh de página, sesión activa y datos del perfil visibles (2026-10-08) |
| CA3 | **Verificado en ejecución** | DevTools: sessionStorage de `http://localhost:3000` vacío; tras el refresh de `/perfil` la sesión siguió activa y el perfil mostró Dueño Demo / DUEÑO / Kiosko Demo (2026-10-08) |
| CA4 | **Verificado en ejecución** | Cajero con `must_change_password: true` → redirigido a `/cambiar-contrasena`; tras el cambio → `/vender` y en Supabase Authentication la metadata quedó en `false` (2026-10-08) |
| CA5 | **Verificado en ejecución** | Navegación y `/perfil` con sesión real: Dueño y Cajero ven menú y datos propios de su rol (2026-10-08) |
| CA6 | **Verificado en ejecución** | Base descartable `kiosko-demo-test`: ANTES `anon` veía 40 filas de `productos` (reproducción terminada con `ROLLBACK`); DESPUÉS `ERROR: 42501 permission denied for table productos`; post-rollback: `current_user` = postgres, 0 grants a `anon` y 0 policy `demo_anon_read_productos`. `0001`–`0008` sin cambios y la base compartida nunca se tocó |
| CA7 | Verificado | `mock.ts` y `mock.test.ts` no existen; 0 referencias a `getMockSession`/`storeMockSession`/`clearMockSession`; `npm run test`, `lint`, `build` y `test:e2e` en verde |

CA2–CA5 verificadas manualmente el 2026-10-08; detalle por CA en las filas de esta tabla y en `spec.md`.

Migraciones aplicadas solo en la base descartable `kiosko-demo-test` (`0001`–`0007`, `supabase/seed.sql` y `0008`); la base compartida `kiosko-demo` no se usó para ninguna. `git diff -- supabase/migrations` está vacío: los 8 archivos intactos.

## Revisión de PR (puntos bloqueantes)

- [x] Frontera de módulo: `getAuthProfile` y `SessionProfile` se exportan desde `src/modules/auth/index.ts`; `(app)/layout.tsx`, `(app)/perfil/page.tsx` y `cambiar-contrasena/page.tsx` importan solo desde `@/modules/auth`. `navigation.tsx` (client) pasó a importar `splitBrandName` de `@/modules/auth/brand` porque el barrel ahora arrastra `queries.ts` y `next/headers` al bundle del cliente.
- [x] `src/middleware.ts` usa `isSupabaseConfigured()` como `config/queries.ts` y `auth/queries.ts`.
- [x] CA1 con prueba e2e real.
- [ ] Mover login / change-password / logout a Server Actions: **decisión de Jordy, no se aplica en este PR.**
- [ ] Puntos menores de la review: **fuera de alcance de este PR.**
