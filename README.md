# Punto de Venta Web (Māra Labs)

Punto de venta para comercios minoristas argentinos. Next.js 15 + Supabase + Tailwind/shadcn. Ver `CLAUDE.md` para decisiones de arquitectura y fases.

## Requisitos

- Node 22+ y npm
- Un proyecto de Supabase (plan gratuito alcanza)

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar URL y anon key de Supabase
```

```bash
npm run dev        # http://localhost:3000
```

## Base de datos

Las migraciones viven en `supabase/migrations/` y se aplican **en orden numérico** (`0001` a `0007`). Con `psql` y el connection string del pooler (Supabase → Settings → Database → Transaction pooler):

```bash
# una migración (todo o nada, frena en el primer error)
psql "<connection-string>" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/000X_nombre.sql

# instalación nueva: migraciones 0001..0007 y después el seed base
psql "<connection-string>" -f supabase/seed.sql
```

Usuarios de prueba (uno por rol) para desarrollo. Las contraseñas **no se versionan**: se pasan por variable.

```bash
psql "<connection-string>" -v ON_ERROR_STOP=1 \
  -v dueno_pw='...' -v encargado_pw='...' -v cajero_pw='...' \
  -f supabase/seed_dev_users.sql
```

Validación de la Fase 1 (aislamiento entre comercios, permisos por rol, `registrar_venta`, fallos sin rastro). Corre dentro de una transacción que se revierte:

```bash
psql "<connection-string>" -X -v ON_ERROR_STOP=1 -f supabase/tests/fase1_validation.sql
```

Reglas para migraciones nuevas: por defecto `anon` y `authenticated` **no tienen ningún privilegio** sobre tablas nuevas. Cada tabla necesita `enable row level security`, políticas por `comercio_id` y `GRANT` explícitos (por columna cuando corresponda). `productos.stock_actual` solo lo modifica el trigger de `movimientos_stock`; las ventas solo se escriben con la función `registrar_venta`.

## Comandos

| Comando            | Qué hace                      |
| ------------------ | ----------------------------- |
| `npm run dev`      | Servidor de desarrollo        |
| `npm run build`    | Build de producción           |
| `npm run lint`     | ESLint                        |
| `npm run format`   | Prettier                      |
| `npm run test`     | Tests unitarios (Vitest)      |
| `npm run test:e2e` | Tests end-to-end (Playwright) |

## Estructura

`src/modules/<modulo>/` con `actions.ts`, `queries.ts`, `schemas.ts` y `components/`. Un módulo importa de otro solo por su `index.ts`.
