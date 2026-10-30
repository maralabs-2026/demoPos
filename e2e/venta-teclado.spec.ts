import { expect, test } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Fase 4e: una venta completa solo con teclado, en menos de 6 acciones.
// Usuario de supabase/seed_dev_users.sql; la contraseña sale de variables de entorno.

const DUENO_EMAIL = "dueno@kiosko.demo";
const COCA = "7790010000154"; // Coca-Cola 500ml, $ 2.500

test.describe("Venta solo con teclado", () => {
  test("cobra un producto en 4 acciones: escanear, Enter, monto recibido y F2", async ({
    page,
  }) => {
    await login(page, DUENO_EMAIL, passwordDe("E2E_DUENO_PASSWORD"));
    await abrirCajaSiHaceFalta(page);

    // Acción 1: escanear el código de barras (el campo de búsqueda ya tiene el foco).
    const buscar = page.getByLabel("Buscar producto");
    await buscar.fill(COCA);
    // Acción 2: Enter agrega el producto al ticket.
    await buscar.press("Enter");
    await expect(
      page.getByLabel("Ticket").getByText("1 artículo"),
    ).toBeVisible();
    // Acción 3: monto recibido justo.
    await page.getByLabel("Monto recibido").fill("2500");
    // Acción 4: F2 cobra.
    await page.keyboard.press("F2");

    await expect(
      page.getByRole("heading", { name: "Venta cobrada" }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
