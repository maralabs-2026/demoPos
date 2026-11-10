import { expect, test, type Page } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Fase 4d-2 de punta a punta: crear un combo Coca + Bon o Bon por $ 3.500 (normal $ 4.000),
// cobrar una unidad de cada una y ver el combo en el ticket. Al terminar, el combo se pausa.

const COCA = "7790010000154"; // Coca-Cola 500ml, $ 2.500
const BON = "7790010000017"; // Cofler Bon o Bon, $ 1.500
const NOMBRE_COMBO = `E2E combo ${Date.now()}`;
const PRECIO_COMBO = 3500;

// Pausa los combos de prueba que hayan quedado activos en una corrida anterior.
async function pausarCombosDeEnsayo(page: Page) {
  await page.goto("/promociones");
  const pausar = page
    .getByRole("listitem")
    .filter({ hasText: "E2E combo" })
    .getByRole("button", { name: "Pausar" });
  while ((await pausar.count()) > 0) {
    const antes = await pausar.count();
    await pausar.first().click();
    await expect(pausar).toHaveCount(antes - 1, { timeout: 15_000 });
  }
}

test("combo Coca + Bon o Bon: el ticket muestra el combo y cobra $ 3.500", async ({
  page,
}) => {
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
  await pausarCombosDeEnsayo(page);

  try {
    await page.goto("/promociones");
    await page.getByPlaceholder("Coca + Pepsi").fill(NOMBRE_COMBO);
    await page.getByLabel("Precio del combo").fill(String(PRECIO_COMBO));
    await page.getByLabel("Incluir Coca-Cola 500ml").check();
    await page.getByLabel("Incluir Cofler Bon o Bon").check();
    await page.getByRole("button", { name: "Creá el combo" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: NOMBRE_COMBO }),
    ).toBeVisible({ timeout: 15_000 });

    await abrirCajaSiHaceFalta(page);
    const buscar = page.getByLabel("Buscar producto");
    await buscar.fill(COCA);
    await buscar.press("Enter");
    await buscar.fill(BON);
    await buscar.press("Enter");

    const ticket = page.getByLabel("Ticket");
    // El combo se muestra en las dos líneas que lo componen.
    await expect(ticket.getByText(`Promo: ${NOMBRE_COMBO}`)).toHaveCount(2);
    await expect(ticket.getByTestId("total-venta")).toHaveText(/\$ 3\.500/);

    await page.getByLabel("Monto recibido").fill(String(PRECIO_COMBO));
    await page.keyboard.press("F2");
    await expect(
      page.getByRole("heading", { name: "Venta cobrada" }),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await pausarCombosDeEnsayo(page);
  }
});
