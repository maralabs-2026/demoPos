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

Base de datos: en el SQL Editor de Supabase ejecutar, en orden, `supabase/migrations/0001_comercios.sql` y `supabase/seed.sql`.

```bash
npm run dev        # http://localhost:3000
```

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
