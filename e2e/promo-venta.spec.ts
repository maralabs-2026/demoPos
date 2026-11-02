import { expect, test } from "@playwright/test";
import {
  abrirCajaSiHaceFalta,
  login,
  passwordDe,
  pausarPromosDeEnsayo,
} from "./helpers";

// Fase 4d de punta a punta: crear una promo 2x1, cobrar dos unidades y ver el descuento en el
// ticket y en la venta. Al terminar, la promo se pausa para no alterar otras pruebas.

const COCA = "7790010000154"; // Coca-Cola 500ml, $ 2.500
// Nombre único por corrida: la limpieza pausa la promo, no la borra.
const NOMBRE_PROMO = `E2E 2x1 Coca ${Date.now()}`;

test("promo 2x1: dos Coca cobran $ 2.500 y el ticket muestra la promo", async ({
  page,
}) => {
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
  // Promos E2E de corridas anteriores: sin esto, una vieja podría ganar el desempate.
  await pausarPromosDeEnsayo(page);

  try {
    // Crear la promo en /promociones (valores por defecto: llevá 2, pagá 1, todos los días).
    await page.goto("/promociones");
    await page.getByLabel("Nombre", { exact: true }).fill(NOMBRE_PROMO);
    await page
      .locator("select:has(option:text-is('Coca-Cola 500ml'))")
      .selectOption({ label: "Coca-Cola 500ml" });
    await page.getByRole("button", { name: "Creá la promo" }).click();
    await expect(page.getByText(NOMBRE_PROMO)).toBeVisible({ timeout: 15_000 });

    // Vender dos unidades del producto.
    await abrirCajaSiHaceFalta(page);
    const buscar = page.getByLabel("Buscar producto");
    // Dos veces el mismo código: el buscador se vacía después de cada Enter.
    await buscar.fill(COCA);
    await buscar.press("Enter");
    await buscar.fill(COCA);
    await buscar.press("Enter");

    const ticket = page.getByLabel("Ticket");
    await expect(ticket.getByText(`Promo: ${NOMBRE_PROMO}`)).toBeVisible();
    await expect(
      ticket.getByRole("button", { name: /Cobrá \$ 2\.500/ }),
    ).toBeVisible();

    await page.getByLabel("Monto recibido").fill("2500");
    await page.keyboard.press("F2");
    await expect(
      page.getByRole("heading", { name: "Venta cobrada" }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText("Promo", { exact: false }).first(),
    ).toBeVisible();
  } finally {
    // Limpieza: pausar la promo de prueba.
    await page.goto("/promociones");
    const fila = page.getByRole("listitem").filter({ hasText: NOMBRE_PROMO });
    if (await fila.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fila.getByRole("button", { name: "Pausar" }).click();
    }
  }
});
