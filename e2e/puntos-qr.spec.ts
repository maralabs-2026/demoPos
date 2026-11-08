import { expect, test } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// Bloque 3.5b: el dueño carga un QR y lo desactiva. El QR queda en la base de pruebas.

test("config: el dueño agrega y desactiva un QR de Mercado Pago", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const sufijo = Date.now().toString(36);
  const nombre = `E2E QR ${sufijo}`;
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));

  await page.goto("/config/pagos");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Agregá un QR" }).click();
  const dialogo = page.locator("[data-slot=dialog-content]");
  await dialogo.getByLabel("Nombre").fill(nombre);
  await dialogo
    .getByLabel("Identificador de la caja en Mercado Pago")
    .fill("con espacios");
  await dialogo.getByRole("button", { name: "Guardá el QR" }).click();
  await expect(dialogo.getByRole("alert")).toContainText("sin espacios");

  await dialogo
    .getByLabel("Identificador de la caja en Mercado Pago")
    .fill(`E2E${sufijo}`);
  await dialogo.getByRole("button", { name: "Guardá el QR" }).click();
  await expect(dialogo).toBeHidden({ timeout: 20_000 });

  const fila = page
    .getByRole("list", { name: "QR cargados" })
    .getByRole("listitem")
    .filter({ hasText: nombre });
  await expect(fila).toBeVisible();
  await fila.getByRole("button", { name: "Desactivá" }).click();
  await expect(fila).toContainText("Inactivo", { timeout: 20_000 });
});
