// Prepara la base de pruebas (kiosko-demo-test) antes de correr Playwright:
//   1. Borra lo que dejaron corridas anteriores: promos, combos y productos "E2E ...".
//      Un producto E2E con movimientos de stock o ventas queda: no se borran.
//   2. Deja el producto de stock-concurrencia con stock exactamente 1 y repone Coca-Cola y
//      Bon o Bon, que consumen los tests de venta, promo y combo.
//
//   node --env-file=.env.e2e.local scripts/e2e-preparar.mjs     # en local
//   node scripts/e2e-preparar.mjs                               # en CI (variables ya cargadas)
//
// Usa la service role de TEST y se niega a correr si la URL no es la de kiosko-demo-test.
// Es idempotente: correrlo dos veces seguidas no cambia nada la segunda vez.

import { createClient } from "@supabase/supabase-js";

const TEST_URL = "https://nxpvhfyilruileakhldq.supabase.co"; // kiosko-demo-test
const COMERCIO = "Kiosko Demo";
const STOCK1 = "9990000000999";
const REPONER = ["7790010000154", "7790010000017"]; // Coca-Cola y Bon o Bon
const MOTIVO = "Fixture e2e";

function abort(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url !== TEST_URL)
  abort("NEXT_PUBLIC_SUPABASE_URL no es kiosko-demo-test. No se cambió nada.");
if (!key) abort("falta SUPABASE_SERVICE_ROLE_KEY (la de test).");

const db = createClient(url, key, { auth: { persistSession: false } });

async function run(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function main() {
  const comercio = await run(
    "comercio",
    db.from("comercios").select("id").eq("nombre", COMERCIO).single(),
  );
  const comercioId = comercio.id;
  const dueno = await run(
    "dueño",
    db
      .from("perfiles")
      .select("id")
      .eq("comercio_id", comercioId)
      .eq("rol", "dueno")
      .limit(1)
      .single(),
  );

  // 1. Limpieza de corridas anteriores.
  const promos = await run(
    "promos E2E",
    db
      .from("promociones")
      .delete()
      .eq("comercio_id", comercioId)
      .ilike("nombre", "E2E %")
      .select("id"),
  );
  const combos = await run(
    "combos E2E",
    db
      .from("combos")
      .delete()
      .eq("comercio_id", comercioId)
      .ilike("nombre", "E2E %")
      .select("id"),
  );
  const candidatos = await run(
    "productos E2E",
    db
      .from("productos")
      .select("id")
      .eq("comercio_id", comercioId)
      .ilike("nombre", "E2E %"),
  );
  let productosBorrados = 0;
  let productosConservados = 0;
  if (candidatos.length > 0) {
    const ids = candidatos.map((p) => p.id);
    // movimientos_stock es de solo agregado: un producto con movimientos (por ejemplo, el
    // "E2E stock inicial" del popup) queda.
    const movidos = await run(
      "movimientos de productos E2E",
      db.from("movimientos_stock").select("producto_id").in("producto_id", ids),
    );
    // Un servicio (0031) vendido no tiene movimientos, pero sus ventas lo usan: también queda.
    const vendidos = await run(
      "ventas de productos E2E",
      db.from("venta_items").select("producto_id").in("producto_id", ids),
    );
    const conHistoria = new Set([
      ...movidos.map((m) => m.producto_id),
      ...vendidos.map((v) => v.producto_id),
    ]);
    const borrables = ids.filter((id) => !conHistoria.has(id));
    productosConservados = ids.length - borrables.length;
    if (borrables.length > 0) {
      const borrados = await run(
        "borrar productos E2E",
        db.from("productos").delete().in("id", borrables).select("id"),
      );
      productosBorrados = borrados.length;
    }
  }

  // 2. Stock que necesitan los tests.
  const categoria = await run(
    "categoría",
    db
      .from("categorias")
      .select("id")
      .eq("comercio_id", comercioId)
      .order("orden")
      .limit(1)
      .single(),
  );
  await run(
    "producto stock 1",
    db.from("productos").upsert(
      {
        comercio_id: comercioId,
        categoria_id: categoria.id,
        nombre: "Producto e2e (stock 1)",
        codigo_barras: STOCK1,
        precio: 100,
        unidad_venta: "unidad",
        stock_minimo: 0,
      },
      { onConflict: "comercio_id,codigo_barras", ignoreDuplicates: true },
    ),
  );

  const productos = await run(
    "stock actual",
    db
      .from("productos")
      .select("id, nombre, codigo_barras, stock_actual")
      .eq("comercio_id", comercioId)
      .in("codigo_barras", [STOCK1, ...REPONER]),
  );
  const ajustes = productos
    .map((p) => {
      const objetivo = p.codigo_barras === STOCK1 ? 1 : 50;
      const faltan = objetivo - p.stock_actual;
      const ajustar = p.codigo_barras === STOCK1 ? faltan !== 0 : faltan > 0;
      return ajustar
        ? {
            comercio_id: comercioId,
            producto_id: p.id,
            tipo: "ajuste",
            cantidad: faltan,
            motivo: MOTIVO,
            usuario_id: dueno.id,
          }
        : null;
    })
    .filter(Boolean);
  if (ajustes.length > 0) {
    await run("ajustes de stock", db.from("movimientos_stock").insert(ajustes));
  }
  if (productos.length !== REPONER.length + 1) {
    throw new Error(
      `se esperaban ${REPONER.length + 1} productos del fixture y hay ${productos.length}`,
    );
  }

  console.log(
    `Base de test lista: ${promos.length} promos, ${combos.length} combos y ` +
      `${productosBorrados} productos E2E borrados (${productosConservados} con movimientos o ventas quedan); ` +
      `${ajustes.length} ajustes de stock.`,
  );
}

main().catch((error) => abort(error.message));
