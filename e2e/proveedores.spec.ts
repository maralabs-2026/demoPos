import { expect, test } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// Bloque 3.4a: alta de proveedor, proveedor habitual del producto y pedido por WhatsApp desde la
// reposición. El proveedor y el producto quedan en la base de pruebas, desactivado y borrado
// respectivamente cuando se puede.

const DUENO = "dueno@kiosko.demo";

test("proveedores: el pedido de reposición sale agrupado y va al teléfono del proveedor", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const sufijo = Date.now().toString(36);
  const proveedor = `E2E proveedor ${sufijo}`;
  const producto = `E2E pedido ${sufijo}`;
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));

  // Alta del proveedor. Un teléfono inválido se rechaza.
  await page.goto("/stock/proveedores");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  // El aviso "guardado" también tiene rol de diálogo: se mira solo el popup.
  const dialogo = page.locator("[data-slot=dialog-content]");
  await dialogo.getByLabel("Nombre").fill(proveedor);
  await dialogo.getByLabel("Teléfono (opcional)").fill("123");
  await dialogo.getByRole("button", { name: "Guardá el proveedor" }).click();
  await expect(dialogo.getByRole("alert")).toContainText("código de país");
  await dialogo.getByLabel("Teléfono (opcional)").fill("+54 9 351 123-4567");
  await dialogo.getByRole("button", { name: "Guardá el proveedor" }).click();
  await expect(dialogo).toBeHidden({ timeout: 20_000 });
  const fila = page.getByRole("listitem").filter({ hasText: proveedor });
  await expect(fila).toContainText("5493511234567");

  // Producto bajo el mínimo con ese proveedor habitual.
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.locator("[data-slot=dialog-content]");
  await popup.getByLabel("Nombre del producto *").fill(producto);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  await expect(popup.getByLabel("Código de barras *")).toHaveValue(/^20/, {
    timeout: 20_000,
  });
  await popup
    .getByLabel("Proveedor habitual")
    .selectOption({ label: proveedor });
  await popup.getByLabel("Precio de venta final *").fill("1000");
  await popup.getByLabel("Stock mínimo").fill("2");
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });

  // La reposición lo agrupa y el enlace abre el chat del proveedor con el pedido.
  await page.goto("/stock/reposicion");
  const pedido = page.getByRole("region", { name: `Pedido: ${proveedor}` });
  await expect(pedido).toContainText(producto);
  await expect(pedido).toContainText("Pedí 4");
  const enlace = pedido.getByRole("link", {
    name: "Mandá el pedido por WhatsApp",
  });
  await expect(enlace).toHaveAttribute(
    "href",
    new RegExp(
      `^https://wa\\.me/5493511234567\\?text=.*4%20%C3%97%20E2E%20pedido`,
    ),
  );

  // Limpieza: el producto sin movimientos se borra y el proveedor se desactiva.
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");
  page.once("dialog", (d) => void d.accept());
  await page
    .getByRole("row")
    .filter({ hasText: producto })
    .getByRole("button", { name: "Eliminar" })
    .click();
  await expect(page.getByRole("row").filter({ hasText: producto })).toHaveCount(
    0,
    { timeout: 20_000 },
  );
  await page.goto("/stock/proveedores");
  await page.waitForLoadState("networkidle");
  await fila.getByRole("button", { name: "Desactivá" }).click();
  await expect(fila).toContainText("Inactivo", { timeout: 20_000 });
});
