import { expect, test } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Bloque 3.4b: una compra suma el stock, actualiza el costo, carga el gasto de mercadería y avisa
// si bajó el margen. El producto y el proveedor quedan en la base de pruebas: tienen historia.

const DUENO = "dueno@kiosko.demo";

test("compras: suma el stock, sube el costo y avisa el margen, con el pago en la caja", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const sufijo = Date.now().toString(36);
  const proveedor = `E2E compra prov ${sufijo}`;
  const producto = `E2E compra ${sufijo}`;
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await abrirCajaSiHaceFalta(page);

  await page.goto("/stock/proveedores");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  const dialogo = page.locator("[data-slot=dialog-content]");
  await dialogo.getByLabel("Nombre").fill(proveedor);
  await dialogo.getByRole("button", { name: "Guardá el proveedor" }).click();
  await expect(dialogo).toBeHidden({ timeout: 20_000 });

  // Producto con costo $ 500 y precio $ 1.000: margen 50 %.
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.locator("[data-slot=dialog-content]");
  await popup.getByLabel("Nombre del producto *").fill(producto);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  const campoCodigo = popup.getByLabel("Código de barras *");
  await expect(campoCodigo).toHaveValue(/^20/, { timeout: 20_000 });
  const codigo = await campoCodigo.inputValue();
  await popup.getByLabel("Precio de costo").fill("500");
  await popup.getByLabel("Precio de venta final *").fill("1000");
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });

  // Compra: 10 unidades, lista $ 800 con 10 % de bonificación, pagada con la caja propia.
  await page.goto("/stock/compras");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Proveedor").selectOption({ label: proveedor });
  await page.getByLabel("Remito o factura (opcional)").fill(`R-${sufijo}`);
  const buscar = page.getByLabel("Buscar producto para la compra");
  await buscar.fill(codigo);
  await buscar.press("Enter");
  await page.getByLabel(`Cantidad de ${producto}`).fill("10");
  await page.getByLabel(`Costo de lista de ${producto}`).fill("800");
  await page.getByLabel(`Bonificación de ${producto}`).fill("10");
  await expect(page.getByText("Total $ 7.200,00")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Pago", exact: true })
    .selectOption("caja");
  await page
    .getByRole("combobox", { name: "Caja", exact: true })
    .selectOption({ label: "Mi caja" });
  await page.getByRole("button", { name: "Registrá la compra" }).click();

  // Avisa que bajó el margen, sin cambiar el precio.
  const suben = page.getByRole("list", { name: "Costos que subieron" });
  await expect(suben).toContainText(producto, { timeout: 20_000 });
  await expect(suben).toContainText("50");
  await expect(suben).toContainText("28");
  const historial = page.getByRole("list", { name: "Últimas compras" });
  await expect(historial).toContainText(`${proveedor} · R-${sufijo}`);

  // Stock y costo actualizados; precio igual.
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");
  const fila = page.getByRole("row").filter({ hasText: producto });
  await expect(fila).toContainText("10 unidad");
  await expect(fila).toContainText("$ 720,00");
  await expect(fila).toContainText("$ 1.000,00");

  // El gasto queda como mercadería y pagado.
  await page.goto("/caja/gastos");
  await expect(page.locator("main")).toContainText(`Compra: ${proveedor}`);
  await expect(page.locator("main")).toContainText("Mercadería");
});
