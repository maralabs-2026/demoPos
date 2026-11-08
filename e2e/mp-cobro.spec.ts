import { expect, test, type Page } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Bloque 3.5b: cobro con QR contra el simulador de e2e/mp-falso.mjs. Un QR activo cambia el cobro de
// los demás tests, así que siempre se desactiva al terminar.

async function desactivarQrs(page: Page) {
  await page.goto("/config/pagos");
  await page.waitForLoadState("networkidle");
  const seccion = page.getByRole("region", { name: "QR de Mercado Pago" });
  const activos = seccion.getByRole("button", { name: "Desactivá" });
  while ((await activos.count()) > 0) {
    const antes = await activos.count();
    await activos.first().click();
    await expect(activos).toHaveCount(antes - 1, { timeout: 20_000 });
  }
}

test.afterEach(async ({ page }) => {
  await desactivarQrs(page);
});

test("cobro con QR: aprueba solo, se cancela y se confirma a mano", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const sufijo = Date.now().toString(36);
  const nombre = `E2E servicio cobro ${sufijo}`;
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
  await desactivarQrs(page);

  await page.getByRole("button", { name: "Agregá un QR" }).click();
  const alta = page.locator("[data-slot=dialog-content]");
  await alta.getByLabel("Nombre").fill(`E2E cobro ${sufijo}`);
  await alta
    .getByLabel("Identificador de la caja en Mercado Pago")
    .fill(`E2EC${sufijo}`);
  await alta.getByRole("button", { name: "Guardá el QR" }).click();
  await expect(alta).toBeHidden({ timeout: 20_000 });

  await page.goto("/productos");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.locator("[data-slot=dialog-content]");
  await popup.getByLabel("Nombre del producto *").fill(nombre);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  const campoCodigo = popup.getByLabel("Código de barras *");
  await expect(campoCodigo).toHaveValue(/^20\d{11}$/, { timeout: 20_000 });
  const codigo = await campoCodigo.inputValue();
  await popup.getByLabel("Precio de venta final *").fill("1000");
  await popup.getByLabel(/Es un servicio/).check();
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });

  await abrirCajaSiHaceFalta(page);
  const dialogo = page.locator("[data-slot=dialog-content]");
  const esperando = dialogo.getByText("Esperando el pago…");
  const cobrada = page.getByRole("heading", { name: "Venta cobrada" });

  async function iniciarCobro() {
    const buscar = page.getByLabel("Buscar producto");
    await buscar.fill(codigo);
    await buscar.press("Enter");
    await page.getByRole("button", { name: "QR (Mercado Pago)" }).click();
    await page.keyboard.press("F2");
    await expect(esperando).toBeVisible({ timeout: 20_000 });
  }

  // El aviso de pago aprobado cierra la venta sola.
  await iniciarCobro();
  const pago = await fetch("http://127.0.0.1:4010/__pagar", { method: "POST" });
  expect(pago.ok).toBe(true);
  await expect(cobrada).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Nueva venta" }).click();

  // Cancelar vuelve al ticket sin perderlo.
  await iniciarCobro();
  await dialogo.getByRole("button", { name: "Cancelá el cobro" }).click();
  await expect(dialogo).toBeHidden({ timeout: 20_000 });
  await expect(page.getByLabel("Ticket")).toContainText(nombre);
  await page.keyboard.press("F4");

  // A mano: la venta queda para revisar.
  await iniciarCobro();
  await dialogo.getByRole("button", { name: "Ya pagó" }).click();
  await dialogo
    .getByRole("button", { name: "Confirmá el pago a mano" })
    .click();
  await expect(cobrada).toBeVisible({ timeout: 20_000 });

  await page.goto("/inicio");
  await page
    .getByRole("link", { name: /QR confirmado a mano/ })
    .first()
    .click();
  await expect(page.getByText("QR confirmado a mano")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /revisada/i }).click();
  await expect(page.getByText(/Revisada por/)).toBeVisible({ timeout: 20_000 });
});
