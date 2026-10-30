import { expect, test, type Page } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Fase 4e: dos ventas simultáneas del mismo producto con stock 1. Una se cobra y la otra falla
// limpiamente (registrar_venta bloquea el producto con FOR UPDATE).
// Requiere el fixture supabase/tests/e2e_fixture_stock1.sql en la base de pruebas.

const CODIGO = "9990000000999";
const PRECIO = "100";

// Cada venta termina en "Venta cobrada" o en un aviso de stock; nunca en otra cosa.
async function resultadoDeLaVenta(
  page: Page,
): Promise<"cobrada" | "sin-stock"> {
  const cobrada = page.getByRole("heading", { name: "Venta cobrada" });
  const sinStock = page.getByRole("alert").filter({ hasText: /stock/i });
  await expect(cobrada.or(sinStock).first()).toBeVisible({ timeout: 20_000 });
  return (await cobrada.isVisible()) ? "cobrada" : "sin-stock";
}

test("dos ventas simultáneas del último producto: una se cobra y la otra falla limpia", async ({
  browser,
}) => {
  const contextoA = await browser.newContext();
  const contextoB = await browser.newContext();
  const a = await contextoA.newPage();
  const b = await contextoB.newPage();

  try {
    await login(a, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await login(
      b,
      "encargado@kiosko.demo",
      passwordDe("E2E_ENCARGADO_PASSWORD"),
    );
    await abrirCajaSiHaceFalta(a);
    await abrirCajaSiHaceFalta(b);

    // Los dos cargan el mismo producto (stock 1) y el mismo monto antes de cobrar.
    for (const page of [a, b]) {
      await page.getByLabel("Buscar producto").fill(CODIGO);
      await page.getByLabel("Buscar producto").press("Enter");
      await page.getByLabel("Monto recibido").fill(PRECIO);
    }

    // Cobran a la vez.
    await Promise.all([a.keyboard.press("F2"), b.keyboard.press("F2")]);

    const resultados = [
      await resultadoDeLaVenta(a),
      await resultadoDeLaVenta(b),
    ].sort();
    expect(resultados).toEqual(["cobrada", "sin-stock"]);
  } finally {
    await contextoA.close();
    await contextoB.close();
  }
});
