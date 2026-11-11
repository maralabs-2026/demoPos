import { expect, test } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// 0042: un producto con historia no se borra, se desactiva. Deja de ofrecerse al vender y se puede
// reactivar. Queda en la base de pruebas, activo, porque tiene una venta (no se borra).

const DUENO = "dueno@kiosko.demo";

test("producto con ventas: eliminar ofrece desactivar, deja de venderse y se reactiva", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const nombre = `E2E desactivar ${Date.now().toString(36)}`;
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");

  // Un servicio, para venderlo sin cargar stock.
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.getByRole("dialog");
  await popup.getByLabel("Nombre del producto *").fill(nombre);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  await expect(popup.getByLabel("Código de barras *")).toHaveValue(
    /^20\d{11}$/,
    { timeout: 20_000 },
  );
  await popup.getByLabel("Precio de venta final *").fill("1000");
  await popup.getByLabel(/Es un servicio/).check();
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });

  // Una venta le da historia.
  await abrirCajaSiHaceFalta(page);
  const buscar = page.getByLabel("Buscar producto");
  await buscar.fill(nombre);
  await buscar.press("Enter");
  await expect(page.getByLabel("Ticket").getByTestId("total-venta")).toHaveText(
    /\$ 1\.000/,
  );
  await page.getByLabel("Monto recibido").fill("1000");
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({ timeout: 20_000 });

  // Eliminar: el primer confirm es "¿Eliminar?"; el segundo ofrece desactivarlo.
  await page.goto("/productos");
  await page.getByLabel("Buscar producto").fill(nombre);
  const fila = page.getByRole("row").filter({ hasText: nombre });
  const dialogos: string[] = [];
  page.on("dialog", (dialog) => {
    dialogos.push(dialog.message());
    void dialog.accept();
  });
  await fila.getByRole("button", { name: "Eliminar" }).click();
  await expect(fila).toHaveCount(0, { timeout: 20_000 });
  expect(dialogos).toHaveLength(2);
  expect(dialogos[1]).toContain("no se puede eliminar");
  expect(dialogos[1]).toContain("desactivarlo");

  // Aparece entre los desactivados, marcado.
  await page.getByRole("button", { name: /^Desactivados \(\d+\)$/ }).click();
  const inactiva = page.getByRole("row").filter({ hasText: nombre });
  await expect(inactiva).toContainText("Desactivado");
  await page.screenshot({
    path: "test-results/productos-desactivados.png",
    fullPage: true,
  });

  // No se ofrece al vender.
  await page.goto("/vender");
  await buscar.fill(nombre);
  await buscar.press("Enter");
  await expect(page.getByLabel("Ticket")).not.toContainText(nombre);

  // La ayuda lo explica.
  await page.goto("/ayuda");
  await page.getByLabel("Buscá en la ayuda").fill("desactivar producto");
  await expect(page.getByText("Dejá de vender un producto")).toBeVisible();

  // Reactivarlo lo devuelve a la lista y a la venta.
  await page.goto("/productos");
  await page.getByRole("button", { name: /^Desactivados \(\d+\)$/ }).click();
  await page.getByLabel("Buscar producto").fill(nombre);
  const reactivar = page
    .getByRole("row")
    .filter({ hasText: nombre })
    .getByRole("button", { name: "Reactivar" });
  await reactivar.click();
  await expect(reactivar).toHaveCount(0, { timeout: 20_000 });
  // Si era el único desactivado, la lista ya volvió sola a los activos.
  const verActivos = page.getByRole("button", { name: "Ver activos" });
  if (await verActivos.isVisible()) await verActivos.click();
  const activa = page.getByRole("row").filter({ hasText: nombre });
  await expect(activa).toBeVisible();
  await expect(activa).not.toContainText("Desactivado");

  await page.goto("/vender");
  await buscar.fill(nombre);
  await buscar.press("Enter");
  await expect(page.getByLabel("Ticket")).toContainText(nombre);
});
