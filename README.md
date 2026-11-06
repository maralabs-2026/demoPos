# Punto de Venta Web (Māra Labs)

Punto de venta para comercios minoristas argentinos. Next.js 15 + Supabase + Tailwind/shadcn. Ver `CLAUDE.md` para decisiones de arquitectura y fases.

## Requisitos

- Node 22+ y npm 10 (npm 11 borra del `package-lock.json` binarios opcionales que el build necesita; si tenés npm 11, usá `npx npm@10.9.2 install`)
- Un proyecto de Supabase (plan gratuito alcanza)
- La CLI de Supabase (`npx supabase`) para aplicar migraciones y generar tipos

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local   # completar URL, anon key y service role de Supabase
npm run dev                  # http://localhost:3000
```

## Variables de entorno

| Variable                        | Dónde se usa         | Secreta                                                                               |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | navegador y servidor | no                                                                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador y servidor | no (la protege la RLS)                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | solo servidor        | **sí**: saltea la RLS. Nunca con prefijo `NEXT_PUBLIC_`, nunca en el repo ni en chats |

La service role la usan el alta, el blanqueo y la desactivación de usuarios, y el cambio de la contraseña temporal. Sin ella, esas pantallas fallan.

## Base de datos

Las migraciones viven en `supabase/migrations/` y se aplican **en orden numérico**. El historial de la CLI está sincronizado en test y en producción (desde `0026`), así que `db push` aplica solo las que faltan y las registra:

```bash
npx supabase link --project-ref <ref-del-proyecto>
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Corré siempre el `--dry-run` antes y revisá que liste solo las migraciones nuevas del PR. Si alguna vez se aplica una migración a mano (`db query -f`), registrala después con `npx supabase migration repair --status applied 00NN --linked` para que el historial no se desincronice.

Reglas para migraciones nuevas: por defecto `anon` y `authenticated` **no tienen ningún privilegio** sobre tablas nuevas. Cada tabla necesita `enable row level security`, políticas por `comercio_id` y `GRANT` explícitos (por columna cuando corresponda). `productos.stock_actual` solo lo modifica el trigger de `movimientos_stock`; las ventas solo se escriben con la función `registrar_venta`.

### Tipos generados

`src/lib/supabase/database.types.ts` sale de la base de pruebas. Después de cada migración, regeneralo y formatealo:

```bash
npx supabase gen types typescript --linked --schema public > src/lib/supabase/database.types.ts
npx prettier --write src/lib/supabase/database.types.ts
```

Volvé a poner las dos líneas de comentario del principio. Los argumentos de funciones que aceptan `null` se corrigen en `src/lib/supabase/types.ts`, no en el archivo generado.

### Datos de prueba

`supabase/seed.sql` carga el comercio "Kiosko Demo" con 40 productos, categorías, medios de pago y configuración. Es para pruebas y demos, no para un comercio real.

Usuarios de prueba (uno por rol). Las contraseñas **no se versionan**: se pasan por variable.

```bash
psql "<connection-string>" -v ON_ERROR_STOP=1 \
  -v dueno_pw='...' -v encargado_pw='...' -v cajero_pw='...' \
  -f supabase/seed_dev_users.sql
```

Las validaciones de cada fase están en `supabase/tests/` y corren dentro de una transacción que se revierte. **Corrélas solo contra la base de pruebas**, nunca en producción.

## Despliegue

Producción corre en Vercel, conectado al repo de GitHub: cada merge a `main` publica.

1. **Migraciones primero.** Aplicá en la base de producción las migraciones nuevas del PR **antes** de mergear, y verificá con una consulta de solo lectura que los objetos existan. El código nuevo cuenta con la base nueva; el código anterior tiene que seguir funcionando con ella.
2. **Merge.** Mergeá el PR a `main`. Vercel arma el deploy de producción solo.
3. **Comprobá.** En Vercel → Deployments, el deploy del commit de merge tiene que quedar `Ready`. Abrí las rutas nuevas y fijate que no haya errores en los logs.

Si el deploy no aparece (pasó con la conexión de Git o durante incidentes de Vercel), revisá Settings → Git del proyecto y [vercel-status.com](https://www.vercel-status.com). Como último recurso, publicá `main` a mano desde una copia limpia:

```bash
vercel deploy --prod --scope <equipo>
```

## Checklist de puesta en marcha (comercio nuevo)

**Infraestructura**

- [ ] Proyecto de Supabase creado, en la región más cercana (São Paulo para Argentina).
- [ ] Todas las migraciones aplicadas en orden, de `0001` a la última.
- [ ] Supabase → Authentication → Sign In / Providers: registro público **desactivado** (los usuarios los crea el dueño o el encargado).
- [ ] Las tres variables de entorno cargadas en Vercel → Settings → Environment Variables, en Production.
- [ ] Vercel conectado al repo, con `main` como rama de producción.

**Comercio y primer dueño** (el resto de los usuarios los crea el dueño desde `/usuarios`)

- [ ] Crear el comercio: `insert into public.comercios (nombre) values ('<nombre>') returning id;`
- [ ] Crear el usuario dueño en Supabase → Authentication → Users → Add user, con el correo confirmado.
- [ ] Crear su perfil: `insert into public.perfiles (id, comercio_id, rol, nombre) values ('<id del usuario>', '<id del comercio>', 'dueno', '<nombre>');`
- [ ] Cargar al menos un medio de pago de tipo `efectivo` (el fondo de la caja y los retiros salen de ahí).

**Desde la app, entrando como dueño**

- [ ] `/config`: título, leyenda y pie del ticket; medios de pago; categorías.
- [ ] `/productos`: cargar el catálogo a mano o importar un CSV (modelo en `supabase/seed/productos.csv`).
- [ ] `/usuarios`: crear encargados y cajeros. Entran con una contraseña temporal y la cambian en el primer ingreso.
- [ ] Prueba completa en el dispositivo del mostrador: abrir caja, vender con el lector de barras, imprimir el ticket, cerrar caja y ver el reporte del día.

## Comandos

| Comando            | Qué hace                      |
| ------------------ | ----------------------------- |
| `npm run dev`      | Servidor de desarrollo        |
| `npm run build`    | Build de producción           |
| `npm run lint`     | ESLint                        |
| `npm run format`   | Prettier                      |
| `npm run test`     | Tests unitarios (Vitest)      |
| `npm run test:e2e` | Tests end-to-end (Playwright) |

Los tests e2e corren contra la base de pruebas, con un solo worker: comparten datos. `node scripts/e2e-set-passwords.mjs` define las contraseñas de los usuarios de prueba en `.env.e2e.local` (solo funciona contra la base de pruebas).

## Estructura

`src/modules/<modulo>/` con `actions.ts`, `queries.ts`, `schemas.ts` y `components/`. Un módulo importa de otro solo por su `index.ts`.
