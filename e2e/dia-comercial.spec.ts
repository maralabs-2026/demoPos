import { expect, test, type Page } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// El dueño elige la hora de corte del día comercial y se conserva. Otros tests cuentan con el día
// calendario, así que al terminar vuelve siempre a medianoche.

const DUENO = "dueno@kiosko.demo";

async function guardarCorte(page: Page, valor: string) {
  await page.goto("/config");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("El día termina a las").selectOption(valor);
  await page.getByRole("button", { name: "Guardá la hora de corte" }).click();
  await expect(page.getByText("Hora de corte guardada").first()).toBeVisible({
    timeout: 20_000,
  });
}

test("día comercial: el dueño elige la hora de corte y se conserva", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  try {
    await guardarCorte(page, "6");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("El día termina a las")).toHaveValue("6");

    // El reporte y el historial siguen abriendo con la hora de corte puesta.
    await page.goto("/reportes");
    await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
    await page.goto("/reportes/ventas");
    await expect(
      page.getByRole("heading", { name: "Historial de ventas" }),
    ).toBeVisible();
    await page.goto("/inicio");
    await expect(page.getByText("Vendido hoy")).toBeVisible();
  } finally {
    await guardarCorte(page, "0");
  }
  await page.reload();
  await expect(page.getByLabel("El día termina a las")).toHaveValue("0");
});
