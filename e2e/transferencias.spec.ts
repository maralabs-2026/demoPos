import { expect, test } from "@playwright/test";
import {
  abrirCajaSiHaceFalta,
  login,
  passwordDe,
  pausarPromosDeEnsayo,
} from "./helpers";

// Control de transferencias: una venta cobrada por transferencia aparece para verificar; el dueño
// la marca como no llegada (sale en Inicio) y después como llegada. Cada marca queda registrada.

const DUENO_EMAIL = "dueno@kiosko.demo";
const COCA = "7790010000154"; // Coca-Cola 500ml, $ 2.500

test("transferencias: se marcan como llegadas o no, y lo que no llegó sale en Inicio", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page, DUENO_EMAIL, passwordDe("E2E_DUENO_PASSWORD"));
  await pausarPromosDeEnsayo(page);
  await abrirCajaSiHaceFalta(page);

  const buscar = page.getByLabel("Buscar producto");
  await buscar.fill(COCA);
  await buscar.press("Enter");
  await page
    .getByRole("button", { name: "Transferencia", exact: true })
    .click();
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({ timeout: 20_000 });

  // Con un solo worker, la última transferencia del día es la de este test.
  await page.goto("/caja/transferencias");
  const ultima = () =>
    page
      .getByRole("list", { name: "Transferencias del día" })
      .getByRole("listitem")
      .last();
  await expect(ultima()).toContainText("$ 2.500,00");
  await expect(ultima()).toContainText("Sin verificar");

  // No llegó: queda a la vista y aparece en Inicio.
  await ultima().getByRole("button", { name: "No llegó", exact: true }).click();
  await expect(ultima()).toContainText("No llegó");
  await expect(ultima()).toContainText("Marcó");
  await page.goto("/inicio");
  await expect(page.getByRole("list", { name: "Pendientes" })).toContainText(
    /transferencias? que no lleg/,
  );

  // Llegó después: se corrige con la marca contraria y sale de "Por revisar".
  await page.goto("/caja/transferencias?ver=todas");
  await expect(ultima()).toContainText("No llegó");
  await ultima().getByRole("button", { name: "Llegó", exact: true }).click();
  await expect(ultima()).toContainText("2 marcas");
  await expect(
    ultima().getByRole("button", { name: "Llegó", exact: true }),
  ).toHaveCount(0);
});

test("transferencias: el cajero no entra", async ({ page }) => {
  await login(page, "cajero@kiosko.demo", passwordDe("E2E_CAJERO_PASSWORD"));
  await page.goto("/caja/transferencias");
  await expect(page).not.toHaveURL(/\/caja\/transferencias/);
});
