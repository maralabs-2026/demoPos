# Plan: Auth UI Fase 2
## Archivos a crear o tocar
1. `src/modules/auth/schemas.ts` — Zod compartido de login y cambio de contraseña (mismo esquema cliente/servidor).
2. `src/modules/auth/mock.ts` — datos de prueba por rol, aislados, con `// TODO(fase-2): reemplazar por Supabase Auth (semana 2)`.
3. `src/modules/auth/components/` — LoginForm, ChangePasswordForm, Navigation (menú por rol) y Profile (solo lectura: nombre, correo, rol, comercio).
4. `src/app/login`, `/cambiar-contrasena`, `/perfil` + layout raíz — pantallas según design/auth.pen.
## Decisiones técnicas
Sin Server Actions ni Supabase Auth esta semana: formularios client validados con Zod contra `mock.ts`; error genérico "Correo o contraseña incorrectos"; contraseña temporal redirige a `/cambiar-contrasena` antes de usar el sistema; `next` validado (solo rutas propias, default `/vender`); menú: dueño (Vender, Productos, Reportes, Config, Mi perfil), encargado y cajero (Vender, Productos, Mi perfil); sin selector de comercio.
## Riesgos
Semana 2 (Supabase Auth) reemplaza `mock.ts` y agrega `actions.ts`; aislado en el módulo auth, sin tocar `supabase/` ni instalar dependencias.
## Cómo se verifica
`npm run build`, `npm run lint` y `npm run test`; en `npm run dev` comparar pantallas y menús contra `design/auth.pen` en 360 px y escritorio.