import { expect, test } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Bloque 3.3: un producto con precio al cobrar se vende con el monto que escribe quien cobra,
// solo con teclado. Queda en la base de pruebas porque tiene una venta (no se borra).

const DUENO = "dueno@kiosko.demo";

test("precio al cobrar: se escribe el monto al vender y queda guardado", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const nombre = `E2E precio libre ${Date.now().toString(36)}`;
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");

  // Alta: servicio con precio al cobrar y precio sugerido 0.
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.getByRole("dialog");
  await popup.getByLabel("Nombre del producto *").fill(nombre);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  const codigoCampo = popup.getByLabel("Código de barras *");
  await expect(codigoCampo).toHaveValue(/^20\d{11}$/, { timeout: 20_000 });
  const codigo = await codigoCampo.inputValue();
  await popup.getByLabel("Precio de venta final *").fill("0");
  await popup.getByLabel(/Precio al cobrar/).check();
  await popup.getByLabel(/Es un servicio/).check();
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });

  // Al editarlo, la marca sigue puesta.
  const fila = page.getByRole("row").filter({ hasText: nombre });
  await fila.getByRole("button", { name: "Editar" }).click();
  await expect(
    page.getByRole("dialog").getByLabel(/Precio al cobrar/),
  ).toBeChecked();
  await page.keyboard.press("Escape");

  // Venta solo con teclado: escanear, el foco pasa al precio.
  await abrirCajaSiHaceFalta(page);
  const buscar = page.getByLabel("Buscar producto");
  await buscar.fill(codigo);
  await buscar.press("Enter");
  const precio = page.getByLabel(`Precio de ${nombre}`);
  await expect(precio).toBeFocused();

  // Sin precio no se cobra.
  await page.keyboard.press("F2");
  await expect(
    page.getByText(`Escribí el precio de "${nombre}"`),
  ).toBeVisible();
  await expect(precio).toBeFocused();

  await precio.fill("1500");
  await precio.press("Enter");
  await expect(buscar).toBeFocused();
  const ticket = page.getByLabel("Ticket");
  await expect(
    ticket.getByRole("button", { name: /Cobrá \$ 1\.500/ }),
  ).toBeVisible();
  await page.getByLabel("Monto recibido").fill("1500");
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({
    timeout: 20_000,
  });
  // El comprobante sale de lo que guardó la venta: el precio escrito.
  await expect(page.locator("main")).toContainText("$ 1.500,00");
});
