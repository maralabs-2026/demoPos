# CLAUDE.md — Punto de Venta Web (Māra Labs)

Este archivo es el contexto permanente del proyecto. Leelo completo antes de cualquier tarea.
Al final hay una secuencia de fases: ejecutá **una fase por vez**, corré la validación y **detenete a esperar aprobación** antes de seguir.

Estado actual: **Demo aprobada por el cliente.** Las Fases 0 y D están hechas y son la base del producto. Se ejecutan las Fases 1 a 7 en orden, una por vez y con aprobación explícita por fase.

---

## 1. Qué estamos construyendo

Un punto de venta web para comercios minoristas argentinos (kiosco, almacén, ferretería, indumentaria). Primer cliente: **un kiosco** de barrio con productos de consumo básico. Objetivo secundario: que el código sirva de base para más comercios sin reescribir.

Prioridades en este orden:
1. **Rapidez en el mostrador.** Una venta con lector de barras se cierra en menos de 5 segundos y sin usar el mouse.
2. **Datos correctos.** Stock y caja nunca quedan inconsistentes, ni con dos cajeros vendiendo a la vez.
3. **Simplicidad.** Lo usa gente sin formación técnica desde el celular, la tablet o la PC.
4. **Reutilizable.** Multi-tenant desde el día uno, configuración en datos, módulos separados.

Lo que NO se construye en esta versión: facturación electrónica ARCA, Mercado Pago, cuenta corriente, multi-sucursal, e-commerce. Dejar los puntos de extensión, no implementarlos.

## 2. Stack (no cambiar sin aprobación)

- Next.js 15 (App Router, Server Actions, TypeScript estricto)
- Supabase: Postgres, Auth, RLS, Storage
- Tailwind CSS + shadcn/ui
- Zod para validación en cliente y servidor
- Deploy: Vercel
- Tests: Vitest (unitarios) + Playwright (flujo de venta end-to-end)
- Sin ORM: SQL en migraciones de Supabase; tipos generados con `supabase gen types`

## 3. Decisiones de arquitectura (obligatorias)

**Multi-tenant**
- Toda tabla de negocio lleva `comercio_id uuid not null references comercios(id)`.
- Toda tabla tiene RLS activado. Política base: el usuario solo accede a filas cuyo `comercio_id` coincide con el de su perfil.
- Nunca filtrar por `comercio_id` solo en el cliente; la RLS es la barrera real.

**Configuración en datos, no en código**
- Medios de pago, categorías, roles, datos del ticket, moneda y formato de precios viven en tablas de configuración por comercio.
- Prohibido hardcodear nombres de medios de pago, rubros o textos del ticket.

**Módulos separados**
```
src/
  modules/
    auth/        # login, perfil, roles
    productos/   # catálogo, categorías, precios, códigos de barras
    stock/       # movimientos, ajustes, alertas de mínimo
    ventas/      # pantalla de cobro, pagos, comprobantes
    caja/        # apertura, cierre, arqueo
    reportes/    # consultas agregadas, exportación
    config/      # configuración por comercio
  components/ui/ # shadcn
  lib/           # supabase client, utils, formato de moneda
```
- Un módulo no importa de otro salvo a través de su `index.ts` público.
- Cada módulo tiene: `actions.ts` (server actions), `queries.ts`, `schemas.ts` (Zod), `components/`.

**Integridad de datos**
- Una venta es una transacción atómica: cabecera + ítems + pagos + movimientos de stock, o nada. Usar una función SQL (`rpc`) para cerrar la venta, no varias llamadas desde el cliente.
- El stock se calcula como suma de movimientos, no como un campo que se sobreescribe. El campo `stock_actual` en productos es una caché que se actualiza por trigger.
- Los precios se guardan en la venta al momento de vender (snapshot). Cambiar el precio de un producto no altera ventas pasadas.
- Montos en `numeric(12,2)`, nunca `float`.

**Roles**
- `dueno`: todo.
- `encargado`: todo menos configuración y eliminar usuarios.
- `cajero`: vender, ver productos, abrir/cerrar su caja. No ve costos, márgenes ni reportes.

## 4. Convenciones

- Código en inglés (variables, funciones, tablas); textos de interfaz en español rioplatense (voseo: "Cobrá", "Buscá").
- Server Actions para toda escritura; validar con Zod antes de tocar la base.
- Errores: nunca `console.log` y seguir. Toda acción devuelve `{ ok: true, data } | { ok: false, error }`.
- Formato de moneda: `$ 1.234,56` (separador de miles punto, decimales coma).
- Fechas en UTC en base; mostrar en `America/Argentina/Cordoba`.
- Componentes: server components por defecto; `"use client"` solo cuando hay interacción.
- Commits pequeños con mensaje en inglés: `feat(ventas): add combined payments`.
- No instalar dependencias sin decirlo explícitamente y justificarlo.

## 5. Cómo trabajar conmigo

- Antes de escribir código en una fase, mostrá en 10 líneas o menos qué archivos vas a crear o tocar y por qué. Esperá mi OK.
- Cambios chicos y revisables. Si una tarea supera ~300 líneas, dividila.
- Si una instrucción de este archivo choca con lo que te pido en el chat, avisá antes de hacer nada.
- Al terminar cada fase, corré la validación indicada y pegá el resultado. No digas "listo" sin evidencia.
- Si algo no está definido, preguntá; no inventes requisitos.
- En etapa DEMO: si una decisión de diseño no afecta la demo pero sí el producto final, tomá la que sirve al producto final. La demo no se tira: se convierte en el producto.

---

## 6. Secuencia de fases

Ejecutar en orden. Una fase por sesión de trabajo. No avanzar sin aprobación explícita.

### Fase 0 — Cimientos
Crear el proyecto Next.js con el stack de la sección 2, conectar Supabase, configurar Tailwind + shadcn, ESLint/Prettier, Vitest y Playwright vacíos, estructura de carpetas de la sección 3, `.env.example`, y un README con los comandos para levantar el proyecto.
**Validación:** `npm run build`, `npm run lint` y `npm run test` pasan sin errores. La app levanta en local y muestra una página vacía con el nombre del comercio leído de la base.

### Fase D — Demo comercial (timebox: 2 días)
Objetivo: que el comerciante haga una venta completa en su celular y su PC en la primera reunión, y sienta que el sistema es rápido y simple. Nada de lo que no se muestre en la reunión se construye acá.

Alcance:
- Migraciones mínimas reales (no mock): `comercios`, `categorias`, `productos` (con `codigo_barras`, `precio`, `stock_actual`, `stock_minimo`), `medios_pago`. RLS activado aunque haya un solo comercio y sin login (usar la `anon key` con una política temporal que se elimina en Fase 2, marcada con `-- TODO(demo)`).
- Seed con 40 productos reales de kiosco, con nombres de marcas argentinas conocidas, precios actuales en pesos y códigos de barras EAN-13 verosímiles. Distribución sugerida: 8 golosinas y chocolates, 6 galletitas y snacks, 8 bebidas (gaseosas, agua, jugos, energizantes, cerveza en lata), 5 cigarrillos y encendedores, 4 lácteos y panificados (leche, yogur, pan lactal, facturas), 5 productos de almacén básico (arroz, fideos, yerba, azúcar, aceite), 4 higiene y limpieza (papel higiénico, jabón, pañales, lavandina). Incluir 3 productos con `stock_actual` por debajo de `stock_minimo` y 2 con stock cero para mostrar las alertas. Medios de pago: efectivo, débito, crédito, transferencia, QR (Mercado Pago).
- Particularidades de kiosco a tener en cuenta desde la demo: muchas ventas de un solo ítem de bajo monto, y productos que se venden por unidad y por pack (dejar `unidad_venta` en productos como campo de texto, sin lógica todavía).
- Pantalla de cobro `/vender`: campo de búsqueda con foco permanente que acepta código de barras (Enter) o texto; lista de ítems con cantidad editable; total grande; panel de pagos con un medio de pago (los combinados van en Fase 4) y cálculo de vuelto; atajos `F2` cobrar, `F4` cancelar. Al cobrar, descuenta stock con una server action simple (la transacción atómica `registrar_venta` llega en Fase 1) y muestra un comprobante en pantalla con botón "Nueva venta".
- Pantalla `/productos`: listado con búsqueda, columna de stock y resaltado en rojo de los que están bajo mínimo. Solo lectura.
- Layout con logo del comercio y navegación entre las dos pantallas. Responsive verificado en 360 px y en escritorio.
- Deploy en Vercel con URL privada para usar en la reunión.

Fuera de alcance en Fase D (no hacer aunque parezca fácil): login, roles, caja, reportes, descuentos, edición de productos, impresión de ticket, tests e2e.

Regla: todo lo que se escriba en Fase D respeta las secciones 3 y 4. Cada atajo tomado por tiempo se marca con `// TODO(demo): <qué falta y en qué fase se resuelve>`.

**Validación:** en la URL de Vercel, desde un celular, hacer una venta de 3 productos solo con teclado y ver el stock actualizado en `/productos`. `npm run build` limpio. Listar todos los `TODO(demo)` del repo.

### Fase 1 — Modelo de datos y seguridad
Completar las migraciones: `perfiles` (vinculado a `auth.users`, con `rol` y `comercio_id`), `configuracion`, `movimientos_stock`, `cajas`, `ventas`, `venta_items`, `venta_pagos`. RLS definitiva en todas. Trigger que mantiene `productos.stock_actual` a partir de movimientos. Función `rpc` `registrar_venta` transaccional que reemplaza la server action de la demo. Seed con tres usuarios (uno por rol). Resolver todos los `TODO(demo)` asignados a esta fase.
**Validación:** script SQL que (a) intenta leer productos de otro comercio y falla, (b) registra una venta y verifica que el stock bajó y la caja sumó, (c) registra una venta con stock insuficiente y falla sin dejar rastro. Pegar la salida.

### Fase 2 — Autenticación y layout
Login con email y contraseña, recuperación de contraseña, navegación según rol, selector de comercio desactivado (un solo comercio por ahora, pero el código lo soporta). Página de perfil. Eliminar la política RLS temporal de la demo.
**Validación:** test Playwright: el cajero no puede acceder a `/reportes` ni a `/config`; el dueño sí. Capturas de las tres vistas.

### Fase 3 — Productos y stock
ABM de productos con categoría, código de barras, costo, precio, margen calculado, stock mínimo. Ingreso de mercadería. Ajuste manual con motivo. Actualización masiva de precios por categoría o porcentaje. Importación desde CSV con vista previa de errores.
**Validación:** importar el CSV de seed, subir 10% una categoría y verificar en base que solo esa categoría cambió. Tests unitarios de los schemas Zod.

### Fase 4 — Pantalla de cobro completa
Sobre la pantalla de la demo: descuento por ítem y sobre el total según rol, pagos combinados con varios medios, atajos `+`/`-` cantidad, integración con `registrar_venta`, manejo de errores de stock y concurrencia.
**Validación:** test Playwright que hace una venta completa solo con teclado en menos de 6 acciones. Dos ventas simultáneas del mismo producto con stock 1: una debe fallar limpiamente.

### Fase 5 — Caja
Apertura con monto inicial, cierre con conteo por medio de pago, diferencia calculada, historial de cajas. Un cajero no puede vender sin caja abierta.
**Validación:** abrir caja, hacer 3 ventas con distintos medios, cerrar y verificar que los totales por medio de pago coinciden con la base.

### Fase 6 — Reportes y comprobantes
Ventas por día/semana/mes con filtros, ranking de productos, ganancia estimada (precio − costo), ventas por cajero. Exportación a Excel de ventas y stock. Ticket no fiscal imprimible en 58/80 mm (`@media print`) y versión para compartir por WhatsApp.
**Validación:** los totales del reporte diario coinciden con el cierre de caja del mismo día. Ticket correcto en vista previa de impresión.

### Fase 7 — Cierre
Configuración del comercio (datos del ticket, medios de pago, categorías, usuarios). Estados de carga, errores amigables, accesibilidad básica. README con guía de despliegue y checklist de puesta en marcha. Cero `TODO(demo)` restantes.
**Validación:** `npm run build` limpio, tests en verde, Lighthouse > 90 en performance y accesibilidad en la pantalla de cobro. Demo grabada: abrir caja → vender → cerrar caja → ver reporte.

---

## 7. Puntos de extensión (dejar preparados, no implementar)

- `venta_pagos.referencia_externa` y `medios_pago.tipo` (`efectivo | tarjeta | transferencia | qr | cuenta_corriente`) para integrar Mercado Pago después.
- `ventas.comprobante_fiscal_id` nullable para ARCA.
- `comercios` ya soporta N comercios; `perfiles` permitirá un usuario con varios comercios vía tabla intermedia (no crearla ahora).
- Tabla `clientes` no se crea ahora; `ventas.cliente_id` nullable queda reservado.
