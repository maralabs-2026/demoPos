import { expect, test, type Page } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// Fase 5: un gasto pagado con la caja abierta se descuenta del efectivo esperado; uno pagado por
// fuera, no. Usa al encargado, para no pisar la caja del dueño que usan los otros tests.

const ENCARGADO = "encargado@kiosko.demo";

async function cerrarConCeros(page: Page) {
  await page.goto("/caja");
  const cerrar = page.getByRole("button", { name: "Cerrá la caja" });
  if (!(await cerrar.isVisible({ timeout: 4_000 }).catch(() => false))) return;
  for (const campo of await page.getByPlaceholder("0,00").all()) {
    await campo.fill("0");
  }
  await cerrar.click();
  await page.getByRole("button", { name: "Confirmá el cierre" }).click();
  await expect(page.getByRole("heading", { name: "Caja cerrada" })).toBeVisible(
    { timeout: 20_000 },
  );
}

async function cargarGastoPagado(
  page: Page,
  descripcion: string,
  monto: string,
  origen: string,
) {
  await page.getByRole("button", { name: "Cargá un gasto" }).click();
  const popup = page.getByRole("dialog");
  await popup.getByLabel("Descripción").fill(descripcion);
  await popup.getByLabel("Monto").fill(monto);
  await popup
    .getByLabel("¿De dónde salió la plata?")
    .selectOption({ label: origen });
  await popup.getByRole("button", { name: "Guardá el gasto" }).click();
  await expect(popup).toHaveCount(0, { timeout: 20_000 });
}

test("gastos: el pagado con la caja entra en el arqueo y el pagado por fuera no", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const sufijo = Date.now().toString(36);
  const conCaja = `Flete e2e ${sufijo}`;
  const porFuera = `Luz e2e ${sufijo}`;
  const aPagar = `Alquiler e2e ${sufijo}`;

  await login(page, ENCARGADO, passwordDe("E2E_ENCARGADO_PASSWORD"));
  await cerrarConCeros(page);

  await page.goto("/vender");
  await page.getByLabel("Fondo inicial del cajón").fill("1000");
  await page.getByRole("button", { name: /abrí la caja/i }).click();
  await expect(page.getByLabel("Buscar producto")).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/caja");
  await page.getByRole("button", { name: "Gastos" }).click();
  await expect(page.getByRole("heading", { name: "Gastos" })).toBeVisible();

  // Sin elegir de dónde salió la plata no deja guardar.
  await page.getByRole("button", { name: "Cargá un gasto" }).click();
  const popup = page.getByRole("dialog");
  await popup.getByLabel("Descripción").fill(conCaja);
  await popup.getByLabel("Monto").fill("300");
  await popup.getByRole("button", { name: "Guardá el gasto" }).click();
  await expect(
    popup.getByRole("alert").filter({ hasText: "Elegí de dónde salió" }),
  ).toBeVisible();
  await popup.getByLabel("Cerrar").click();

  await cargarGastoPagado(page, conCaja, "300", "Mi caja");
  await cargarGastoPagado(page, porFuera, "450", "Por fuera de la caja");

  // Por pagar: no toca la caja hasta pagarlo, y se paga con la caja.
  await page.getByRole("button", { name: "Cargá un gasto" }).click();
  const popupPorPagar = page.getByRole("dialog");
  await popupPorPagar.getByLabel("Descripción").fill(aPagar);
  await popupPorPagar.getByLabel("Monto").fill("100");
  await popupPorPagar.getByRole("button", { name: "Por pagar" }).click();
  await popupPorPagar.getByLabel("Vencimiento (opcional)").fill("2020-01-15");
  await popupPorPagar.getByRole("button", { name: "Guardá el gasto" }).click();
  await expect(popupPorPagar).toHaveCount(0, { timeout: 20_000 });

  const fila = page
    .getByRole("list", { name: "Gastos por pagar" })
    .getByRole("listitem")
    .filter({ hasText: aPagar });
  await expect(fila).toContainText("Vencido");
  await expect(fila).toContainText("15/01/2020");
  await fila.getByRole("button", { name: "Pagá" }).click();
  const popupPago = page.getByRole("dialog");
  await popupPago
    .getByLabel("¿De dónde salió la plata?")
    .selectOption({ label: "Mi caja" });
  await popupPago.getByRole("button", { name: "Confirmá el pago" }).click();
  await expect(popupPago).toHaveCount(0, { timeout: 20_000 });

  // Anular devuelve la plata a la caja abierta: este gasto no descuenta nada al final.
  const anulado = `Error e2e ${sufijo}`;
  await cargarGastoPagado(page, anulado, "999", "Mi caja");
  const filaAnulada = page
    .getByRole("list", { name: "Gastos pagados y anulados" })
    .getByRole("listitem")
    .filter({ hasText: anulado });
  await filaAnulada.getByRole("button", { name: "Anulá" }).click();
  await page.getByRole("button", { name: "Anular", exact: true }).click();
  await expect(filaAnulada).toContainText("Anulado", { timeout: 20_000 });

  // En la caja se ven los retiros y el ingreso, sin mostrar el esperado.
  await page.goto("/caja");
  const movimientos = page.getByRole("list", { name: "Retiros e ingresos" });
  await expect(movimientos).toContainText(`Gasto: ${conCaja}`);
  await expect(movimientos).toContainText(`Gasto anulado: ${anulado}`);
  await expect(movimientos).not.toContainText(porFuera);
  await expect(page.getByText("Esperado")).toHaveCount(0);

  for (const campo of await page.getByPlaceholder("0,00").all()) {
    await campo.fill("0");
  }
  await page.getByRole("button", { name: "Cerrá la caja" }).click();
  await page.getByRole("button", { name: "Confirmá el cierre" }).click();
  await expect(page.getByRole("heading", { name: "Caja cerrada" })).toBeVisible(
    { timeout: 20_000 },
  );

  // 1000 - 300 (flete) - 100 (alquiler) - 999 + 999 (anulado). La luz, por fuera, no descuenta.
  await expect(
    page.getByRole("listitem").filter({ hasText: "Efectivo" }),
  ).toContainText("Esperado $ 600,00");
});
