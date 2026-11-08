import { expect, test } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Bloque 3.6: una venta se refleja en margen por categoría y horarios; un producto con stock que no
// se vendió aparece sin movimiento. El cajero no entra.

const DUENO = "dueno@kiosko.demo";
const RUTA = "/reportes/analisis";
const COCA = "7790010000154"; // Coca-Cola 500ml, $ 2.500

test("análisis: la venta entra en las secciones y lo que no se vendió queda sin movimiento", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const quieto = `E2E quieto ${Date.now().toString(36)}`;
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));

  // Producto con stock que no se vende.
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.locator("[data-slot=dialog-content]");
  await popup.getByLabel("Nombre del producto *").fill(quieto);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  await expect(popup.getByLabel("Código de barras *")).toHaveValue(/^20/, {
    timeout: 20_000,
  });
  await popup.getByLabel("Precio de costo").fill("100");
  await popup.getByLabel("Precio de venta final *").fill("200");
  await popup.getByLabel("Cantidad en stock").fill("3");
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });

  // Una venta hoy.
  await abrirCajaSiHaceFalta(page);
  const buscar = page.getByLabel("Buscar producto");
  await buscar.fill(COCA);
  await buscar.press("Enter");
  await page.getByLabel("Monto recibido").fill("5000");
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({
    timeout: 20_000,
  });

  await page.goto(RUTA);
  await expect(page.getByRole("heading", { name: "Análisis" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Margen por categoría" }),
  ).toContainText("Bebidas");
  await expect(
    page.getByRole("list", { name: "Ventas por hora" }),
  ).toContainText(":00");
  await expect(
    page.getByRole("list", { name: "Ventas por día de la semana" }),
  ).toContainText("Lunes");

  const sinMovimiento = page.getByRole("list", {
    name: "Productos sin movimiento",
  });
  const fila = sinMovimiento.getByRole("listitem").filter({ hasText: quieto });
  await expect(fila).toContainText("Nunca se vendió");
  await expect(fila).toContainText("$ 300,00");
  await expect(sinMovimiento).not.toContainText("Coca-Cola 500ml");
});

test("análisis: el cajero no entra", async ({ page }) => {
  await login(page, "cajero@kiosko.demo", passwordDe("E2E_CAJERO_PASSWORD"));
  await page.goto(RUTA);
  await expect(page.getByRole("heading", { name: "Análisis" })).toHaveCount(0);
});
