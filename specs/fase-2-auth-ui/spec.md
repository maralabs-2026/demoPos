# Spec: Auth UI Fase 2 (Fase 2)

## Contexto

Esta spec cubre la interfaz de usuario de la Fase 2 del punto de venta MaraLabs, según CLAUDE.md sección 6 (Fase 2 — Autenticación y layout). Incluye login, cambio obligatorio de contraseña, navegación por rol y perfil. Los datos viven en configuración por comercio, sin selector de comercio en la UI.

## Objetivo

Proveer las pantallas UI necesarias para que un usuario se autentique, cambie su contraseña temporal y acceda a su perfil y menú según su rol (dueño, encargado, cajero), sin recuperación por autoservicio y con mensajes de error genéricos.

## Fuera de alcance

- No conectar Supabase Auth (esto es Fase 1, ya cerrado).
- No implementar recuperación de contraseña por autoservicio.
- No crear selector de comercio en la UI.
- No crear pantallas de edición de productos, reportes o configuración.
- No instalar nuevas dependencias.

## Requisitos

- R1. Pantalla de login en `/login` con campos de email y contraseña, errores genéricos: "Correo o contraseña incorrectos".
- R2. Pantalla de cambio de contraseña para quien ingresa con una contraseña temporal; el usuario debe cambiarla antes de usar el sistema.
- R3. Barra de navegación que muestra/esconde links según rol (dueño, encargado, cajero).
- R4. Perfil de solo lectura (nombre, correo, rol, comercio) con cerrar sesión.
- R5. Datos de prueba aislados y marcados con `TODO(fase-2)`.
- R6. Validaciones del lado del cliente y servidor con mismo esquema Zod.

## Validaciones del login

- Correo: recortado y en minúsculas, obligatorio, formato válido, máx. 254.
- Contraseña: obligatoria, máx. 128, sin mínimo ni complejidad, sin recortar.
- Mismo esquema Zod en cliente y servidor.
- Errores de campo específicos; error de autenticación siempre "Correo o contraseña incorrectos".
- Mensajes aparte para: demasiados intentos, usuario desactivado, error de red/servidor.
- Tras un fallo: se conserva el correo, se limpia la contraseña, foco en la contraseña.
- next solo acepta rutas propias (empiezan con "/" y no con "//"); por defecto /vender.
- Botón deshabilitado mientras se envía; Enter envía; foco inicial en el correo.
- Con contraseña temporal: redirige a cambiar contraseña antes que a cualquier pantalla.

### Criterios de aceptación

- [ ] Correo vacío o mal formado muestra error de campo sin llamar al servidor.
- [ ] Credenciales incorrectas muestran solo "Correo o contraseña incorrectos".
- [ ] next=https://sitio-externo.com es ignorado y redirige a /vender.
- [ ] Doble clic en Ingresar envía una sola vez.

Estas decisiones están confirmadas por Jordy.

## Reglas del proyecto que aplican

- Módulos separados: auth en `src/modules/auth/`.
- Código en inglés (variables, funciones, tablas); textos de interfaz en español rioplatense con voseo.
- Server Actions para toda escritura; validar con Zod antes de tocar la base.
- Errores: toda acción devuelve `{ ok: true, data } | { ok: false, error}`.
- No instalar dependencias sin avisar y justificar.
- Formato de moneda: `$ 1.234,56` (separador de miles punto, decimales coma).
- Fechas en `America/Argentina/Cordoba`.

## Nota

- Esta spec no conecta Supabase Auth ni toca `supabase/`. Los datos de prueba se mantienen en `src/modules/auth/mock.ts` con marcadores `TODO(fase-2)`.