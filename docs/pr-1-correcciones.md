# Correcciones — PR #1 (Fase 2, UI de login)

Para: Meli. PR: [`feat/meli-login` → `main` (#1)](https://github.com/maralabs-2026/demoPos/pull/1).

Esto sale de dos pasadas: una revisión mía a mano contra las decisiones de negocio que habíamos cerrado (sin recuperación, sin selector de comercio, cambio obligatorio, errores genéricos, perfil de solo lectura), y dos corridas de `/code-review` sobre el diff real del PR. Está ordenado por qué tan urgente es corregirlo. No incluye nada de la rama de productos/CSV — eso es aparte, de otra tarea.

Lo bueno primero, porque hay bastante: las 4 decisiones de negocio están bien implementadas (sin recuperación, sin selector de comercio, errores de login genéricos, perfil de solo lectura + cerrar sesión), el menú por rol coincide exacto con la tabla que definimos, y hasta agregaste la protección contra redirección abierta en `next` (con tests) sin que te lo pidiéramos. Buen trabajo ahí.

---

## 🔴 Bloqueante antes de mergear

### 1. El cambio de contraseña obligatorio no protege `/vender` ni `/productos`

**Dónde:** `src/app/(app)/layout.tsx`

Hoy solo `Profile` y `ChangePasswordView` chequean `mustChangePassword` a mano, cada uno por su cuenta. Si un cajero loguea con contraseña temporal y en vez de ir a `/cambiar-contrasena` escribe `/vender` en la barra de direcciones (o toca "atrás" del navegador), entra derecho a vender sin haber cambiado la contraseña.

Tu propio `tasks.md` (T5) da esto por cumplido con el criterio "un usuario con contraseña temporal no accede a ninguna otra pantalla hasta cambiarla" — pero no es así todavía. Esto **no** es lo mismo que la protección de rutas por rol con middleware (esa sí es de la semana 2, cuando conectes Supabase Auth). Alcanza con un chequeo en el layout de `(app)`:

```tsx
// src/app/(app)/layout.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMockSession } from "@/modules/auth";

// dentro del layout, antes de renderizar children:
useEffect(() => {
  const session = getMockSession();
  if (session?.mustChangePassword) router.replace("/cambiar-contrasena");
}, [router]);
```

(Ajustalo al patrón que ya usás en `Profile`/`ChangePasswordView` — la idea es que quede en un solo lugar, no repetido por pantalla.)

### 2. Se borró el `NavBar` global y la lectura del nombre del comercio desde la base

**Dónde:** `src/app/layout.tsx`, `src/modules/auth/components/navigation.tsx` (borraste `src/components/nav-bar.tsx`)

El `AppBrand` de tu `Navigation` nueva tiene el nombre del comercio **hardcodeado** en JSX (`"Kiosko"` + `"Demo"` en dos `<span>`), y en `Profile` también aparece fijo en el pie ("© Kiosko Demo"). Esto es una regresión de la Fase 0/D: esa fase valida justamente que el nombre salga de la base (`getComercioName()` en `src/modules/config/queries.ts`, que ahora quedó sin usar, como código muerto y sin ningún TODO que lo marque). El proyecto es multi-tenant a propósito — la sección 3 de `CLAUDE.md` prohíbe hardcodear textos que dependen del comercio. Si mañana se despliega para otro comercio, el header va a seguir diciendo "Kiosko Demo".

También se perdió la banda de gradiente del header (la identidad visual que ya estaba aprobada y deployada) — no hace falta que la repongas igual, pero si tu `Navigation` reemplaza al `NavBar` viejo, tiene que seguir mostrando el nombre real.

**Sugerencia:** que `Navigation` reciba el nombre del comercio por prop (viene de la sesión mock por ahora — `usuario.comercio` ya lo tenés ahí — y en la semana 2 sale de Supabase igual que antes).

---

## 🟡 Recomendado corregir esta semana

### 3. Falta el mínimo de 8 caracteres en la contraseña nueva, y no valida que sea distinta de la temporal

**Dónde:** `src/modules/auth/schemas.ts` → `changePasswordSchema`

Hoy `newPassword` solo pide 1 carácter. Esto sí era una decisión explícita que quedó en tu spec: mínimo 8, y distinta de la temporal.

```ts
newPassword: z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña no puede superar los 128 caracteres"),
```

Para "distinta de la temporal" necesitás la contraseña actual a mano en el formulario (hoy `ChangePasswordForm` no la recibe) — pasásela como prop desde `ChangePasswordView`, que ya tiene la sesión completa, y comparala en el `.refine()`.

### 4. La contraseña queda en texto plano en `sessionStorage`

**Dónde:** `src/modules/auth/mock.ts` → `storeMockSession`

`storeMockSession` guarda el objeto `MockUsuario` completo, contraseña incluida. Cualquiera con DevTools abierto (Application → Session Storage) la ve en texto plano, y nada de la UI necesita leerla de vuelta. Es mock, pero es gratis no hacerlo:

```ts
export function storeMockSession(usuario: MockUsuario): void {
  if (typeof window === "undefined") return;
  const { password: _password, ...sinPassword } = usuario;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sinPassword));
}
```

(Vas a necesitar ajustar el tipo de `getMockSession` ya que el objeto guardado no tendría `password`.)

### 5. Colores hardcodeados en hex en vez de las variables del tema

**Dónde:** `navigation.tsx`, `profile.tsx` (y algún otro)

Hay bastante `bg-[#533AFD]`, `text-[#0D253D]`, `text-[#5B6B7A]`, etc. en vez de las clases semánticas que ya están en `globals.css` (`bg-primary`, `text-foreground`, `text-muted-foreground`). Funciona igual hoy, pero si mañana se toca la paleta (o el modo oscuro), estos valores fijos no se van a enterar. Reemplazalos por las clases del tema donde el color coincida con un token existente.

---

## 🟢 Menor — cuando tengas un rato

- **`login-form.tsx` / `change-password-form.tsx`**: usan `<input>`/`<button>` planos en vez de los componentes `Input`/`Button` de `src/components/ui/` que ya existen en el proyecto. No rompe nada, pero es inconsistente con el resto de la app.
- **`mock.ts`**: el campo `comercio: "Kiosko Central - Sucursal 01"` insinúa multi-sucursal, que `CLAUDE.md` excluye explícitamente de esta versión. Simplificalo a algo como `"Kiosko Demo"`.
- **`src/app/layout.tsx`**: quedó `export const dynamic = "force-dynamic"` sin ningún fetch async que lo justifique ya (se usaba para `getComercioName`). Se puede sacar.
- **`change-password-form.tsx`**: reimplementaste a mano los íconos de ojo abierto/cerrado en SVG, pudiendo usar `Eye`/`EyeOff` de `lucide-react` (ya es dependencia del proyecto, la usás en `navigation.tsx` y `profile.tsx`).
- **`login-form.tsx`**: `authenticateWithMock` devuelve `{ ok, usuario }` / `{ ok, code }` en vez de `{ ok: true, data } | { ok: false, error }`, que es el formato que pide la sección 4 de `CLAUDE.md` para toda acción. Notá que `updateMockPassword`, en el mismo PR, sí lo respeta — conviene unificar.
- **`change-password-view.tsx`**: `{email && (<ChangePasswordForm ... />)}` trata un email vacío (`""`) igual que "no hay sesión", y deja la pantalla en blanco sin error. Borde poco probable con los mocks de hoy, pero fácil de blindar comparando contra `null` en vez de con un truthy check.

---

## Qué haría primero

1. El guard de `mustChangePassword` en el layout (bloqueante #1) — es chico y cierra un agujero real.
2. El nombre del comercio por prop en vez de hardcodeado (bloqueante #2).
3. El mínimo de contraseña (#3) — también chico.
4. El resto, a tu criterio, antes o después del merge.

Actualizá `specs/fase-2-auth-ui/tasks.md` marcando lo que corrijas, así el spec sigue reflejando la realidad (regla de la guía: la spec es la fuente de verdad).
