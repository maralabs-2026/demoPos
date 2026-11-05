import { expect, test } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// Fase 6b: el dueño arranca en el inicio, ve la reposición y una auditoría con diferencias genera
// un ajuste por producto con su motivo.

const DUENO = "dueno@kiosko.demo";
const CATEGORIA = "Bebidas";

// Un producto de la categoría auditada que no toca otro test.
const PRODUCTO = /Agua/i;

async function stockDe(
  page: import("@playwright/test").Page,
  nombre: RegExp,
): Promise<number> {
  await page.goto("/productos");
  const fila = page.getByRole("row").filter({ hasText: nombre }).first();
  await expect(fila).toBeVisible();
  const celdas = await fila.getByRole("cell").allTextContents();
  const stock = celdas.map((c) => c.trim()).find((c) => /^\d+ unidad/.test(c));
  if (stock === undefined) throw new Error(`Sin stock en: ${celdas.join("|")}`);
  return Number.parseInt(stock, 10);
}

test("inicio y auditoría: arranca en el inicio y la auditoría ajusta el stock", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await expect(page).toHaveURL(/\/inicio$/);

  await expect(page.getByText("Vendido hoy")).toBeVisible();
  await expect(page.getByText("Efectivo en caja")).toBeVisible();
  await expect(page.getByText("Ganancia neta del mes")).toBeVisible();

  // Conteo a ciegas, leyendo el stock antes por otra pantalla.
  const stockInicial = await stockDe(page, PRODUCTO);

  await page.goto("/stock");
  await page
    .getByRole("navigation", { name: "Secciones de stock" })
    .getByRole("link", { name: "Auditoría" })
    .click();
  await page.getByLabel("Categoría").selectOption({ label: CATEGORIA });
  await page.getByRole("button", { name: "Empezá a contar" }).click();

  const campo = page.getByLabel(PRODUCTO).first();
  await expect(campo).toBeVisible();
  await expect(page.getByText(/^Stock \d/)).toHaveCount(0);
  // Elegir la categoría recarga la página: se espera a que el formulario esté activo.
  await page.waitForLoadState("networkidle");

  // Sin contar nada no deja aplicar.
  await page.getByRole("button", { name: "Aplicá la auditoría" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Contá al menos un producto" }),
  ).toBeVisible();

  // Sobra una unidad.
  await campo.fill(String(stockInicial + 1));
  await page.getByRole("button", { name: "Aplicá la auditoría" }).click();
  await expect(page.getByText(/Contaste 1 de \d+/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmá la auditoría" }).click();

  const resultado = page.getByRole("list", {
    name: "Resultado de la auditoría",
  });
  await expect(resultado).toContainText("Sobran 1", { timeout: 20_000 });
  await expect(resultado.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText(/generó 1 ajuste/)).toBeVisible();

  expect(await stockDe(page, PRODUCTO)).toBe(stockInicial + 1);

  // Deja el stock como estaba, para no afectar a otros tests.
  await page.goto("/stock/auditoria");
  await page.getByLabel("Categoría").selectOption({ label: CATEGORIA });
  await page.getByRole("button", { name: "Empezá a contar" }).click();
  await expect(page.getByLabel(PRODUCTO).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel(PRODUCTO).first().fill(String(stockInicial));
  await page.getByRole("button", { name: "Aplicá la auditoría" }).click();
  await page.getByRole("button", { name: "Confirmá la auditoría" }).click();
  await expect(
    page.getByRole("list", { name: "Resultado de la auditoría" }),
  ).toContainText("Faltan 1", { timeout: 20_000 });

  // Reposición: se llega por la pestaña y ofrece compartir si hay productos bajo el mínimo.
  await page
    .getByRole("navigation", { name: "Secciones de stock" })
    .getByRole("link", { name: "Reposición" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reposición sugerida" }),
  ).toBeVisible();
  const lista = page.getByRole("list", { name: "Productos a reponer" });
  if (await lista.isVisible()) {
    await expect(lista).toContainText(/Pedí \d+/);
    await expect(
      page.getByRole("link", { name: "Compartí por WhatsApp" }),
    ).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  }
});

test("celular: los accesos que no entran quedan en Más", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await expect(page).toHaveURL(/\/inicio$/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);

  const barra = page.getByRole("navigation", { name: "Principal" }).last();
  await expect(barra.getByRole("link", { name: "Vender" })).toBeVisible();
  await expect(barra.getByRole("link", { name: "Reportes" })).toHaveCount(0);

  await barra.getByRole("button", { name: "Más" }).click();
  await page
    .getByRole("navigation", { name: "Más opciones" })
    .getByRole("link", { name: "Reportes" })
    .click();
  await expect(page).toHaveURL(/\/reportes$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
