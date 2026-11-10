import { expect, test } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Bloque 3.3: un servicio (carga de celular, fotocopia) se vende sin controlar stock y no aparece
// en reposición ni en Stock. Queda en la base de pruebas porque tiene una venta (no se borra).

const DUENO = "dueno@kiosko.demo";

test("servicio: se vende sin stock, varias veces, y no entra en reposición ni en Stock", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const nombre = `E2E servicio ${Date.now().toString(36)}`;
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");

  // Alta como servicio: sin stock mínimo ni stock inicial.
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.getByRole("dialog");
  await popup.getByLabel("Nombre del producto *").fill(nombre);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  await expect(popup.getByLabel("Código de barras *")).toHaveValue(
    /^20\d{11}$/,
    {
      timeout: 20_000,
    },
  );
  await popup.getByLabel("Precio de venta final *").fill("1000");
  await popup.getByLabel(/Es un servicio/).check();
  await expect(popup.getByLabel("Stock mínimo")).toHaveCount(0);
  await expect(popup.getByLabel("Cantidad en stock")).toHaveCount(0);
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });
  const fila = page.getByRole("row").filter({ hasText: nombre });
  await expect(fila).toContainText("Servicio");

  // Editarlo conserva la marca.
  await fila.getByRole("button", { name: "Editar" }).click();
  await expect(
    page.getByRole("dialog").getByLabel(/Es un servicio/),
  ).toBeChecked();
  await page.keyboard.press("Escape");

  // Se vende tres veces sin stock.
  await abrirCajaSiHaceFalta(page);
  const buscar = page.getByLabel("Buscar producto");
  for (let i = 0; i < 3; i++) {
    await buscar.fill(nombre);
    await buscar.press("Enter");
  }
  const ticket = page.getByLabel("Ticket");
  await expect(ticket.getByTestId("total-venta")).toHaveText(/\$ 3\.000/);
  await page.getByLabel("Monto recibido").fill("3000");
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(`3 × ${nombre}`).first()).toBeVisible();

  // No aparece en reposición ni en la pantalla de Stock.
  await page.goto("/stock/reposicion");
  await expect(page.locator("main")).not.toContainText(nombre);
  await page.goto("/stock");
  await page.getByPlaceholder(/Buscá/).first().fill(nombre);
  await expect(page.locator("main")).not.toContainText(nombre);
});
