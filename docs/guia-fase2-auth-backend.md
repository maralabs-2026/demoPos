# Fase 2 — Backend de autenticación (semana 2)

Para: Meli. Sigue el mismo flujo de `docs/guia-flujo-opencode-pen-sdd.md` (leela primero si hace tiempo que no la abrís). Esta tarea es la continuación de tu primera tarea: ahí hiciste la **UI** del login con datos de prueba; ahora se conecta esa UI a **Supabase Auth real**.

## Por qué esta tarea

El PR #1 (UI mock) ya está mergeado a `main`. Pero mientras el login siga siendo mock (`sessionStorage`), nadie puede escribir en la base real: las políticas RLS de `supabase/migrations/0006_rls_definitiva.sql` exigen una sesión autenticada de Supabase (`to authenticated`), y hoy no existe ninguna. Esto ya le bloqueó a Sofi el ABM de productos (PR #2). Terminar esto desbloquea a todo el equipo.

## Alcance

**Sí:**
- Login con `supabase.auth.signInWithPassword`, error genérico ("Correo o contraseña incorrectos") tanto si el usuario no existe como si la contraseña es incorrecta.
- Middleware (`src/middleware.ts`) que refresca la sesión en cada request, con el patrón `@supabase/ssr`. `src/lib/supabase/server.ts` líneas 26-27 ya tiene un comentario esperando esto.
- `rol`, `comercio_id` y `nombre` salen de una consulta a `perfiles` (no de sessionStorage), usando las funciones `current_rol()` / `current_comercio_id()` que ya existen (`supabase/migrations/0003_perfiles_configuracion.sql`).
- El flag "debe cambiar contraseña" se lee de `user_metadata` del usuario en Supabase Auth (`{"must_change_password": true}`) — **no** una columna nueva. Así el dueño/encargado lo sigue seteando a mano desde el panel de Supabase (Auth → Users → editar metadata), tal como pide `CLAUDE.md` para esta etapa.
- `AppShell`, `session-guard.ts`, `navigation.tsx` y `profile.tsx` pasan a leer la sesión real en vez de `getMockSession()`.
- Se elimina el `TODO(demo)` de `supabase/migrations/0006_rls_definitiva.sql:18-20` (el `grant select ... to anon` de `/vender` y `/productos`): con login real ya no hace falta lectura anónima. Esto va en una migración **nueva** (`0008_...sql`), nunca editando una vieja.
- `src/modules/auth/mock.ts` se borra (o queda acotado solo a lo que todavía necesiten sus tests — decidilo en la spec).

**No:**
- Pantalla de blanqueo de contraseña propia del sistema — eso es Fase 7.
- Recuperación de contraseña por autoservicio — no existe, es decisión de Jordy.
- Ningún cambio en `productos`, `ventas`, `cajas`.
- No tocar `supabase/migrations/0001` a `0007` (son de Fase 1, cerrada) — solo se puede *agregar* la `0008` nueva.

## Paso a paso

### Paso 0. Rama
```bash
git checkout main && git pull
git checkout -b feat/auth-backend
```

### Paso 1. Spec
Creá `specs/fase-2-auth-backend/spec.md` (misma plantilla de la sección 6.1 de `docs/guia-flujo-opencode-pen-sdd.md`). Prompt en modo **Plan**:

> Leé `CLAUDE.md` (Fase 2), `docs/guia-fase2-auth-backend.md`, `src/modules/auth/mock.ts`, `src/lib/supabase/client.ts` y `src/lib/supabase/server.ts`. Armá `specs/fase-2-auth-backend/spec.md`: reemplazar el login/sesión mock por Supabase Auth real. No escribas código.

Usá los criterios de aceptación del "Alcance" de arriba como base (CA1 a CA7); no dejes que el agente los invente desde cero.

### Paso 2. Diseño en pen.dev
**Se salta.** Esta tarea es backend puro, no hay pantalla nueva que diseñar.

### Paso 3. Plan técnico
Modo Plan, mismo prompt de siempre apuntando a la nueva spec. Verificá que el plan:
- No toque migraciones viejas (`0001` a `0007`), solo pueda agregar `0008_...sql`.
- Diga cómo van a convivir temporalmente los tests que hoy mockean sesión (`session-guard.test.ts`, `mock.test.ts`, el e2e `change-password-guard.spec.ts`) con el cambio a sesión real.

Esperá el OK de Jordy antes de seguir.

### Paso 4. Tareas
Checklist en `specs/fase-2-auth-backend/tasks.md`, formato de siempre. Orden sugerido:

```md
- [ ] T1 Middleware de refresco de sesión (src/middleware.ts). Cubre CA2.
- [ ] T2 signInWithPassword real en el login + error genérico. Cubre CA1.
- [ ] T3 Query de perfiles (rol, comercio_id, nombre) server-side. Cubre CA3.
- [ ] T4 Leer must_change_password de user_metadata y adaptar el guard. Cubre CA4, CA5.
- [ ] T5 Migración 0008: revocar el SELECT anónimo del TODO(demo). Cubre CA6.
- [ ] T6 Sacar mock.ts y actualizar/borrar sus tests. Cubre CA7.
```

### Paso 5. Implementar
Modo **Build**, una tarea de `tasks.md` por vez. Después de cada tarea: `git diff` completo, `/undo` si algo no cierra, tildar la tarea, commit chico en inglés (`feat(auth): add real supabase session middleware`).

### Paso 6. Verificar
`npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e` sin errores. Probá el login real contra el proyecto de Supabase con un **usuario de prueba**, no con datos reales del kiosco. Recorré los criterios de aceptación de la spec y tildalos con evidencia.

### Paso 7. Cierre
Actualizá la spec si algo cambió en el camino, `git push -u origin feat/auth-backend`, abrí el PR contra `main`, actualizá tu fila en el plan de trabajo. Jordy revisa y mergea — vos no.

## Un permiso que vas a necesitar

Para T5 (migración nueva) y para probar el login real necesitás las credenciales del proyecto de Supabase — ya deberías tenerlas de tu tarea anterior (`.env.local`). Si vas a aplicar la migración contra la base compartida, probala primero con un usuario de prueba.
