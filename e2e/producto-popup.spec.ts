import { expect, test, type Page } from "@playwright/test";
import { eliminarProducto, login, passwordDe } from "./helpers";

// Popup de producto: precio desde el margen, ganancia, categoría nueva, stock inicial y cancelar.
// El producto con stock inicial no se puede borrar (tiene un movimiento), así que queda en la base
// de pruebas con el nombre "E2E stock inicial ...". El resto se borra al terminar.

const DUENO = "dueno@kiosko.demo";

async function abrirNuevo(page: Page) {
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.getByRole("dialog");
  await expect(
    popup.getByRole("heading", { name: "Agregar producto" }),
  ).toBeVisible();
  return popup;
}

test("producto: el popup calcula el precio, crea la categoría y carga el stock inicial", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const sufijo = Date.now().toString(36);
  const nombre = `E2E popup ${sufijo}`;
  const categoria = `E2E cat ${sufijo}`;
  const conStock = `E2E stock inicial ${sufijo}`;

  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");

  // Cancelar no guarda nada.
  let popup = await abrirNuevo(page);
  await popup.getByLabel("Nombre del producto *").fill("No se guarda");
  await popup.getByRole("button", { name: "Cancelá" }).click();
  await expect(popup).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: "No se guarda" }),
  ).toHaveCount(0);

  // Precio desde el margen, ganancia y categoría nueva.
  popup = await abrirNuevo(page);
  await popup.getByLabel("Nombre del producto *").fill(nombre);
  await popup
    .getByLabel("Código de barras *")
    .fill(`9${Date.now()}`.slice(0, 13));
  await popup.getByLabel("Precio de costo").fill("750");
  await popup.getByLabel("Margen %").fill("25");
  await expect(popup.getByLabel("Precio de venta final *")).toHaveValue("1000");
  await expect(popup.getByText("+$ 250,00")).toBeVisible();

  await popup.getByRole("button", { name: "Nueva" }).click();
  await popup.getByLabel("Nombre de la categoría nueva").fill(categoria);
  await popup.getByRole("button", { name: "Creá", exact: true }).click();
  await expect(popup.getByLabel("Categoría", { exact: true })).toHaveValue(
    /.+/,
    {
      timeout: 20_000,
    },
  );
  await expect(
    popup.getByLabel("Categoría", { exact: true }).locator("option:checked"),
  ).toHaveText(categoria);

  // Ctrl+Enter guarda desde cualquier campo.
  await popup.getByLabel("Stock mínimo").fill("2");
  await popup.getByLabel("Stock mínimo").press("Control+Enter");
  await expect(popup).toBeHidden({ timeout: 20_000 });
  const fila = page.getByRole("row").filter({ hasText: nombre });
  await expect(fila).toContainText("$ 1.000,00");
  await expect(fila).toContainText(categoria);
  await expect(fila).toContainText("Sin stock");

  // Editar muestra el stock actual y no ofrece stock inicial.
  await fila.getByRole("button", { name: "Editar" }).click();
  popup = page.getByRole("dialog");
  await expect(
    popup.getByRole("heading", { name: "Editar producto" }),
  ).toBeVisible();
  await expect(popup.getByText("Stock actual")).toBeVisible();
  await expect(popup.getByLabel("Cantidad en stock")).toHaveCount(0);
  await expect(popup.getByLabel("Margen %")).toHaveValue("25");
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();

  // Stock inicial: +5 y +1 entran como ingreso.
  popup = await abrirNuevo(page);
  await popup.getByLabel("Nombre del producto *").fill(conStock);
  await popup
    .getByLabel("Código de barras *")
    .fill(`8${Date.now()}`.slice(0, 13));
  await popup.getByLabel("Precio de venta final *").fill("500");
  await popup.getByRole("button", { name: "Sumá 5 al stock" }).click();
  await popup.getByRole("button", { name: "Sumá 1 al stock" }).click();
  await expect(popup.getByLabel("Cantidad en stock")).toHaveValue("6");
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText("el stock inicial no")).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: conStock }),
  ).toContainText("6 unidad");

  // Limpieza: el producto sin movimientos y su categoría.
  await eliminarProducto(page, nombre);
  await page.goto("/config/categorias");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("list", { name: "Categorías" })
    .getByRole("listitem")
    .filter({ hasText: categoria })
    .getByRole("button", { name: "Eliminá" })
    .click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Categorías" })
      .getByRole("listitem")
      .filter({
        hasText: categoria,
      }),
  ).toHaveCount(0, { timeout: 20_000 });
});
