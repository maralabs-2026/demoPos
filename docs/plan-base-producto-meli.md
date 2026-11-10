# Plan: base de producto del punto de venta

Para: Meli. Preparado el 8/11/2026 a partir del estado de `demoPos` en `main` (`3394f20`).

## 1. Qué queremos

Un repositorio nuevo, separado de `demoPos`, con una base del sistema que se pueda vender de dos formas:

|                       | Suscripción (alquiler)                             | Venta directa                                        |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Qué compra el cliente | Acceso mensual a una plataforma nuestra            | Una copia del sistema, personalizada para su negocio |
| Dónde corre           | Una sola app y una sola base, con muchos comercios | Un Vercel y un Supabase por cliente                  |
| Alta de un cliente    | Registro y plan, sin intervención nuestra          | Script y checklist, lo hacemos nosotros              |
| Cobro                 | Mensual y automático                               | Pago único, con mantenimiento opcional               |

**Decisión central: un solo código, dos formas de desplegarlo.** No hacer dos productos. La diferencia entre los modos se resuelve con configuración (por ejemplo, `PRODUCT_MODE=plataforma|directo`) y con un módulo `plataforma/` que en venta directa queda apagado. Un arreglo en la base tiene que servir para los dos.

## 2. De qué partimos

Ya está hecho en `demoPos` y se conserva:

- Todas las tablas de negocio tienen `comercio_id` y RLS.
- Medios de pago, categorías, datos del ticket, logo y día comercial viven en datos por comercio.
- Módulos separados, migraciones SQL, tests con Vitest y Playwright, CI en GitHub Actions.

Lo que falta para que sea un producto:

- Crear un comercio nuevo sin tocar la base a mano. Hoy el comercio y su dueño salen de un seed.
- Un rol por encima del comercio (nosotros, como operadores). Hoy todo el sistema mira un solo comercio por usuario.
- Planes, suscripciones y qué pasa cuando un comercio no paga.
- Probar el aislamiento con muchos comercios reales, no solo con el caso de test.
- Una forma ordenada de llevar actualizaciones a las copias de venta directa.

## 3. Reglas

1. **Trabajá con tu flujo de siempre** (`docs/guia-flujo-opencode-pen-sdd.md`): spec, plan, tareas, implementar de a una, verificar. Una fase por vez, y se aprueba antes de pasar a la siguiente.
2. **Repositorio privado.** La base es el producto.
3. **Proyectos propios.** Supabase y Vercel nuevos, de desarrollo y de pruebas. Nunca los de `demoPos`.
4. **No se copia:** ningún `.env*`, claves, respaldos ni datos de Zona 24/7. Si necesitás una credencial, se pide y se carga por el panel, no por chat.
5. **El aislamiento es lo primero.** Si un cambio puede dejar a un comercio ver datos de otro, frena todo. La RLS es la barrera; filtrar en la app no alcanza.
6. Heredamos el `CLAUDE.md` de `demoPos` y lo adaptamos en la fase B0. Sus reglas de integridad (ventas atómicas, stock por movimientos, snapshots, caja) no se tocan.

## 4. Fases

### B0. Repositorio limpio

Crear el repo privado desde el `main` de `demoPos`, **sin historial** (un primer commit). Sacar lo que es del cliente o de la demo: refs de proyecto en `.github/workflows/ci.yml` y `scripts/`, seed de "Kiosko Demo", specs viejas, `CLAUDE.md` con el estado de fases. Dejar un seed genérico y levantar los proyectos propios.
**Validación:** `build`, `lint`, unitarios y e2e en verde contra el Supabase de pruebas nuevo, y CI corriendo. Una búsqueda de "Zona 24", "Kiosko" y de los refs de `demoPos` no encuentra nada.

### B1. Alta de un comercio

Función SQL transaccional `crear_comercio`: comercio, dueño, configuración, un efectivo y medios de pago por defecto, o nada. Marca y textos 100 % en datos.
**Validación:** crear dos comercios seguidos, operar en cada uno y comprobar con un script que ninguno lee ni escribe datos del otro, incluido Storage y todas las funciones `security definer`.

### B2. Modos de despliegue

`PRODUCT_MODE` y el módulo `plataforma/`, apagado en modo `directo`. El modo se lee en un solo lugar.
**Validación:** el mismo build funciona en los dos modos; en `directo` las rutas de plataforma dan 404.

### B3. Paquete de venta directa

Script `nuevo-cliente` y checklist: crea o conecta Supabase y Vercel, aplica migraciones, crea el comercio y el dueño. Definir cómo llegan las actualizaciones: versiones con etiqueta, notas de cambios y `db push` por cliente. La personalización va en datos; si hace falta código, por puntos de extensión documentados, para que un cliente no quede fuera de las actualizaciones.
**Validación:** desplegar un cliente de prueba desde cero siguiendo solo el checklist, y actualizarlo a una versión nueva sin perder datos.

### B4. Plataforma: registro y planes

Registro público, creación del comercio con B1, prueba gratis, tablas `planes` y `suscripciones` con RLS, límites por plan (usuarios, productos). Protección contra abuso: confirmación de correo y límite de registros.
**Validación:** e2e de registro a primera venta, y un comercio no puede cambiarse su propio plan.

### B5. Cobro y suspensión

Integrar el cobro mensual detrás de una interfaz, para poder cambiar de proveedor. Webhooks firmados e idempotentes. Comercio impago: período de gracia y después solo lectura. **Nunca se borran sus datos** y debe poder exportarlos.
**Validación:** con el modo de prueba del proveedor: alta, pago, pago rechazado, gracia, solo lectura, reactivación. Un webhook repetido no duplica nada.

### B6. Panel de operador y piloto

Panel para nosotros: comercios, estado de suscripción, soporte. Rol de plataforma aparte de `dueno`, con cada acceso a un comercio registrado. Después, piloto con 2 o 3 comercios y la guía comercial de cada modalidad.
**Validación:** un operador ve lo que necesita, queda el registro, y un dueño no puede entrar al panel.

## 5. Decisiones que tiene que tomar el dueño del proyecto

Antes de la fase indicada. No las definas por tu cuenta:

| Fase | Decisión                                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B0   | Nombre del repo y del producto                                                                                                                                                                |
| B3   | Qué incluye la venta directa: precio, mantenimiento, quién paga Vercel y Supabase                                                                                                             |
| B4   | Planes, precios y días de prueba                                                                                                                                                              |
| B5   | Proveedor de cobro. En `CLAUDE.md`, Mercado Pago solo está aprobado para cobrar ventas con QR (desde el 2026-11-08). Usarlo para cobrar la suscripción es otra decisión: hay que confirmarlo. |
| B5   | Días de gracia y qué se bloquea                                                                                                                                                               |
| B6   | Términos, privacidad y quién responde el soporte                                                                                                                                              |

## 6. Mientras tanto

`demoPos` sigue avanzando (hay vencimientos en curso y más mejoras planificadas), porque tiene un cliente real. Hasta que la base esté estable, las mejoras de `demoPos` se pasan a la base al cerrar cada fase, con su migración. Cuando la base esté lista, se decide si Zona 24/7 pasa a ser un cliente de ella.
