import { expect, test } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Bloque 3.1: el dueño genera un código interno para un producto sin código de fábrica, lo
// encuentra por ese código en la venta y prepara sus etiquetas. El producto no tiene movimientos,
// así que se borra al terminar (y `npm run e2e:preparar` lo borra si el test se corta).

const DUENO = "dueno@kiosko.demo";

test("códigos internos: genera el código, se vende por ese código y se arman las etiquetas", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const nombre = `E2E etiqueta ${Date.now().toString(36)}`;

  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");

  // Generar el código desde el popup.
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.getByRole("dialog");
  await popup.getByLabel("Nombre del producto *").fill(nombre);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  const campoCodigo = popup.getByLabel("Código de barras *");
  await expect(campoCodigo).toHaveValue(/^20\d{11}$/, { timeout: 20_000 });
  const codigo = await campoCodigo.inputValue();
  // Con el código cargado, el botón desaparece.
  await expect(popup.getByRole("button", { name: /Generá uno/ })).toHaveCount(
    0,
  );
  await popup.getByLabel("Precio de venta final *").fill("1500");
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });

  const fila = page.getByRole("row").filter({ hasText: nombre });
  await expect(fila).toContainText(codigo);

  // Etiquetas: vista previa con nombre, precio y barras; tres copias listas para imprimir.
  await fila.getByRole("button", { name: "Etiquetas" }).click();
  const dialogo = page.getByRole("dialog");
  const vista = dialogo.getByTestId("etiqueta-vista");
  await expect(vista).toContainText(nombre);
  await expect(vista).toContainText("$ 1.500,00");
  await expect(
    vista.getByRole("img", { name: `Código de barras ${codigo}` }),
  ).toBeVisible();
  await dialogo.getByLabel("Cantidad").fill("3");
  await expect(
    page.locator(".ticket-print").getByRole("img", { includeHidden: true }),
  ).toHaveCount(3);
  await dialogo.getByLabel("Cantidad").fill("0");
  await expect(dialogo.getByText("Elegí entre 1 y 100")).toBeVisible();
  await expect(
    dialogo.getByRole("button", { name: "Imprimí 58 mm" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();

  // El código generado se encuentra en la venta como cualquier otro. Sin stock no se agrega al
  // ticket, pero el aviso nombra el producto: el código lo encontró. (Cargarle stock dejaría un
  // movimiento y el producto ya no se podría borrar.)
  await abrirCajaSiHaceFalta(page);
  const buscar = page.getByLabel("Buscar producto");
  await buscar.fill(codigo);
  await buscar.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: `"${nombre}" no tiene stock` }),
  ).toBeVisible();

  // Limpieza: sin movimientos, el producto se puede borrar.
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");
  page.once("dialog", (d) => void d.accept());
  await page
    .getByRole("row")
    .filter({ hasText: nombre })
    .getByRole("button", { name: "Eliminar" })
    .click();
  await expect(page.getByRole("row").filter({ hasText: nombre })).toHaveCount(
    0,
    { timeout: 20_000 },
  );
});
