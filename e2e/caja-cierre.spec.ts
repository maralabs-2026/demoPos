import { expect, test, type Page } from "@playwright/test";
import { login, passwordDe, pausarPromosDeEnsayo } from "./helpers";

// Fase 5: abrir caja, tres ventas con distintos medios, cerrar a ciegas y ver cada medio contra lo
// esperado. Usa al encargado, para no pisar la caja del dueño que usan los otros tests.

const ENCARGADO = "encargado@kiosko.demo";
const COCA = "7790010000154"; // Coca-Cola 500ml, $ 2.500

async function vender(page: Page, medio: string) {
  await page.goto("/vender");
  const buscar = page.getByLabel("Buscar producto");
  await buscar.fill(COCA);
  await buscar.press("Enter");
  await page.getByRole("button", { name: medio, exact: true }).click();
  if (medio === "Efectivo") {
    await page.getByLabel("Monto recibido").fill("2500");
  }
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({ timeout: 20_000 });
}

// Si quedó una caja abierta de una corrida anterior, la cierra para arrancar con una limpia.
async function cerrarCajaPrevia(page: Page) {
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

test("cierre: compara lo contado con lo esperado, sin mostrarlo antes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page, ENCARGADO, passwordDe("E2E_ENCARGADO_PASSWORD"));
  await pausarPromosDeEnsayo(page);
  await cerrarCajaPrevia(page);

  await page.goto("/vender");
  await page.getByLabel("Fondo inicial del cajón").fill("1000");
  await page.getByRole("button", { name: /abrí la caja/i }).click();
  await expect(page.getByLabel("Buscar producto")).toBeVisible({
    timeout: 20_000,
  });

  await vender(page, "Efectivo");
  await vender(page, "Efectivo");
  await vender(page, "Débito");

  await page.goto("/caja");
  // A ciegas: el formulario no muestra lo esperado.
  await expect(page.getByText("Esperado")).toHaveCount(0);

  // Sin completar todos los medios no deja seguir.
  await page.getByRole("button", { name: "Cerrá la caja" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Escribí cuánto contaste" }),
  ).toBeVisible();

  for (const campo of await page.getByPlaceholder("0,00").all()) {
    await campo.fill("0");
  }
  // Efectivo esperado: 1000 + 2500 + 2500. Se cuentan $ 100 menos.
  await page.getByLabel("Efectivo").fill("5900");
  await page.getByLabel("Débito").fill("2500");
  await page.getByLabel("Nota (opcional)").fill("Faltó cambio");
  await page.getByRole("button", { name: "Cerrá la caja" }).click();
  await page.getByRole("button", { name: "Confirmá el cierre" }).click();

  await expect(page.getByRole("heading", { name: "Caja cerrada" })).toBeVisible(
    { timeout: 20_000 },
  );
  const efectivo = page.getByRole("listitem").filter({ hasText: "Efectivo" });
  await expect(efectivo).toContainText("Esperado $ 6.000,00");
  await expect(efectivo).toContainText("Contado $ 5.900,00");
  await expect(efectivo).toContainText("Falta $ 100,00");
  const debito = page.getByRole("listitem").filter({ hasText: "Débito" });
  await expect(debito).toContainText("Esperado $ 2.500,00");
  await expect(debito).toContainText("Cuadra");
  await expect(page.getByText("Faltó cambio")).toBeVisible();

  // Sin caja abierta, para vender hay que volver a abrir.
  await page.goto("/vender");
  await expect(
    page.getByRole("heading", { name: "Abrí tu caja" }),
  ).toBeVisible();

  // Y queda en el historial.
  await page.goto("/caja/historial");
  await expect(page.getByRole("listitem").first()).toContainText(
    "Falta $ 100,00",
  );
});
