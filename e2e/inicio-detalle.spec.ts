import { expect, test } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Cada tarjeta del inicio lleva a su detalle, y el efectivo en caja se desglosa por caja con la
// misma cuenta que el esperado del cierre: fondo + ventas en efectivo + ingresos − retiros.

const DUENO = "dueno@kiosko.demo";

// "$ 1.234,56" → 1234.56 (en centavos, para comparar sin errores de redondeo).
function centavos(texto: string): number {
  const limpio = texto.replace(/[^\d,]/g, "").replace(",", ".");
  return Math.round(Number(limpio) * 100);
}

test("inicio: las tarjetas llevan al detalle y el efectivo se desglosa", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  // Con una caja abierta, el inicio tiene algo que desglosar.
  await abrirCajaSiHaceFalta(page);
  await page.goto("/inicio");

  const efectivo = page
    .getByRole("region", { name: "Resumen" })
    .locator("details");
  await efectivo.getByText("Ver detalle").click();

  const cajas = efectivo.locator("dl");
  expect(await cajas.count()).toBeGreaterThan(0);
  for (const caja of await cajas.all()) {
    const montos = (await caja.locator("dd").allTextContents()).map(centavos);
    const [fondo, ventas, ingresos, retiros, total] = montos;
    expect(fondo + ventas + ingresos - retiros).toBe(total);
  }

  // La propia caja del dueño lleva a /caja; la de otro, a operarla.
  const movimientos = efectivo.getByRole("link", { name: "Ver movimientos" });
  for (const enlace of await movimientos.all()) {
    await expect(enlace).toHaveAttribute(
      "href",
      /^\/caja(\/cerrar\/[0-9a-f-]{36})?$/,
    );
  }
  await movimientos.first().click();
  await expect(page).toHaveURL(/\/caja/);

  await page.goto("/inicio");
  await page
    .getByRole("link", { name: "Ver el reporte de lo vendido hoy" })
    .click();
  await expect(page).toHaveURL(
    /\/reportes\?desde=(\d{4}-\d{2}-\d{2})&hasta=\1/,
  );
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();

  await page.goto("/inicio");
  await page.getByRole("link", { name: "Ver el reporte del mes" }).click();
  await expect(page).toHaveURL(/\/reportes\?desde=\d{4}-\d{2}-01&hasta=/);
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
});
