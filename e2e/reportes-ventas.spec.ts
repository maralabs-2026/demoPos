import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { login, passwordDe, pausarPromosDeEnsayo } from "./helpers";

// Fase 6a: una venta aparece en el reporte y el historial, se reimprime, se exporta y se anula. Usa
// al encargado, para no pisar la caja del dueño que usan los otros tests.

const ENCARGADO = "encargado@kiosko.demo";
const COCA = "7790010000154"; // Coca-Cola 500ml, $ 2.500

async function asegurarCaja(page: Page) {
  await page.goto("/vender");
  const fondo = page.getByLabel("Fondo inicial del cajón");
  const buscar = page.getByLabel("Buscar producto");
  await expect(fondo.or(buscar)).toBeVisible({ timeout: 20_000 });
  if (await fondo.isVisible()) {
    await fondo.fill("0");
    await page.getByRole("button", { name: /abrí la caja/i }).click();
    await expect(buscar).toBeVisible({ timeout: 20_000 });
  }
}

test("venta: se reporta, se reimprime, se exporta y se anula", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page, ENCARGADO, passwordDe("E2E_ENCARGADO_PASSWORD"));
  await pausarPromosDeEnsayo(page);
  await asegurarCaja(page);

  const motivo = `Prueba e2e ${Date.now().toString(36)}`;

  // Stock antes de vender, leído de la pantalla de productos.
  const stock = async () => {
    await page.goto(`/productos?q=${COCA}`);
    const fila = page.getByRole("row").filter({ hasText: COCA }).first();
    await expect(fila).toBeVisible();
    return (await fila.textContent()) ?? "";
  };
  const stockInicial = await stock();

  await page.goto("/vender");
  const buscar = page.getByLabel("Buscar producto");
  await buscar.fill(COCA);
  await buscar.press("Enter");
  await page.getByRole("button", { name: "Débito", exact: true }).click();
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({ timeout: 20_000 });

  // El comprobante ofrece imprimir y compartir, sin sacarle el foco a "Nueva venta".
  await expect(page.getByRole("button", { name: "Nueva venta" })).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Imprimí 58 mm" }),
  ).toBeVisible();
  const whatsapp = page.getByRole("link", { name: "Compartí por WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);

  // Reporte de hoy: la venta suma y se puede exportar.
  await page.goto("/reportes");
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Ventas por medio de pago" }),
  ).toContainText("Débito");
  await expect(
    page.getByRole("list", { name: "Ranking de productos" }),
  ).toContainText("Coca");

  for (const [nombre, archivo] of [
    ["Exportá las ventas", /^ventas-.*\.xlsx$/],
    ["Exportá el stock", /^stock-.*\.xlsx$/],
  ] as const) {
    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: nombre }).click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(archivo);
    expect(await descarga.failure()).toBeNull();

    // El archivo se abre como Excel y trae los datos, no solo el nombre correcto.
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(await descarga.path());
    const hoja = libro.worksheets[0];
    const filas: string[] = [];
    hoja.eachRow((fila) => filas.push(JSON.stringify(fila.values)));
    expect(filas.length).toBeGreaterThan(1);
    expect(filas.join("\n")).toContain("Coca-Cola 500ml");
  }

  // Historial: entra por la pestaña y abre la venta más nueva.
  await page
    .getByRole("navigation", { name: "Secciones de reportes" })
    .getByRole("link", { name: "Ventas" })
    .click();
  await page
    .getByRole("list", { name: "Ventas" })
    .getByRole("link")
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /^Venta / })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Ítems de la venta" }),
  ).toContainText("Coca");

  // Vista de impresión: sale solo el ticket.
  await page.emulateMedia({ media: "print" });
  const ticket = page.locator(".ticket-print");
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText("Ticket no fiscal");
  await expect(ticket).toContainText("$ 2.500,00");
  await expect(
    page.getByRole("button", { name: "Anulá la venta" }),
  ).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  // Anular pide motivo, y después devuelve el stock.
  await page.getByRole("button", { name: "Anulá la venta" }).click();
  const popup = page.getByRole("dialog");
  await popup.getByRole("button", { name: "Confirmá la anulación" }).click();
  await expect(
    popup.getByRole("alert").filter({ hasText: "Escribí el motivo" }),
  ).toBeVisible();
  await popup.getByLabel("Motivo").fill(motivo);
  await popup.getByRole("button", { name: "Confirmá la anulación" }).click();
  await expect(page.getByText("Anulada", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(motivo)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Anulá la venta" }),
  ).toHaveCount(0);

  expect(await stock()).toBe(stockInicial);
});
