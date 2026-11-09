import { expect, test, type Page } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// La ayuda es de solo lectura: estos tests entran con cada rol y no tocan datos.

async function irAAyuda(page: Page) {
  await page.getByRole("link", { name: "Ayuda" }).first().click();
  await expect(page).toHaveURL(/\/ayuda$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Ayuda" })).toBeVisible();
}

async function sinScrollHorizontal(page: Page) {
  const desborde = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);
}

test.describe("Ayuda en escritorio", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("el dueño ve mostrador y mercadería", async ({ page }) => {
    await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await irAAyuda(page);

    await expect(
      page.getByRole("heading", { name: "Mostrador" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mercadería" }),
    ).toBeVisible();
  });

  test("el encargado encuentra una guía y va a su pantalla", async ({
    page,
  }) => {
    await login(
      page,
      "encargado@kiosko.demo",
      passwordDe("E2E_ENCARGADO_PASSWORD"),
    );
    await irAAyuda(page);

    await page.getByLabel("Buscá en la ayuda").fill("auditoria");
    await expect(page.getByText("Hacé una auditoría de stock")).toBeVisible();
    await expect(page.getByText("Registrá una compra")).toHaveCount(0);

    await page.getByRole("link", { name: "Ver en la pantalla" }).click();
    await expect(page).toHaveURL(/\/stock\/auditoria$/, { timeout: 20_000 });
  });

  test("una búsqueda sin resultados lo dice", async ({ page }) => {
    await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await irAAyuda(page);

    await page.getByLabel("Buscá en la ayuda").fill("zzzz");
    await expect(page.getByRole("status")).toContainText("No encontramos");
  });
});

test.describe("Ayuda en 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  // El cajero del seed tiene contraseña temporal y no pasa de cambiarla: se usa uno descartable.
  test("el cajero no ve mercadería ni costos", async ({ page, browser }) => {
    test.skip(
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Falta SUPABASE_SERVICE_ROLE_KEY de test en .env.e2e.local",
    );
    test.setTimeout(120_000);

    const email = `e2e-ayuda-${Date.now().toString(36)}@test.invalid`;
    const temporal = "temporal-e2e-123";
    const definitiva = "definitiva-e2e-456";

    const sesionDueno = await browser.newContext();
    const dueno = await sesionDueno.newPage();
    await login(dueno, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await dueno.goto("/usuarios");
    await dueno.waitForLoadState("networkidle");
    await dueno.getByRole("button", { name: "Creá un usuario" }).click();
    const alta = dueno.getByRole("dialog");
    await alta.getByLabel("Nombre").fill("Cajero ayuda e2e");
    await alta.getByLabel("Correo").fill(email);
    await alta.getByLabel("Rol").selectOption({ label: "Cajero" });
    await alta.getByLabel("Contraseña temporal").fill(temporal);
    await alta.getByRole("button", { name: "Creá el usuario" }).click();
    await expect(alta).toHaveCount(0, { timeout: 20_000 });

    await login(page, email, temporal);
    await expect(page).toHaveURL(/\/cambiar-contrasena/);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(definitiva);
    await page.getByLabel(/Confirm/i).fill(definitiva);
    await page.getByRole("button", { name: /cambiar|guardar/i }).click();
    await expect(page).not.toHaveURL(/\/cambiar-contrasena/, {
      timeout: 20_000,
    });

    await page.goto("/vender");
    await irAAyuda(page);

    await expect(
      page.getByRole("heading", { name: "Mostrador" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mercadería" })).toHaveCount(
      0,
    );

    // Busca en el HTML completo: tampoco puede llegar en los datos de la página.
    expect(await page.content()).not.toMatch(
      /Registrá una compra|auditoría de stock|Anulá una venta|Creá un usuario|margen|ganancia/i,
    );
    await sinScrollHorizontal(page);

    // No se borra: se desactiva, para no dejar usuarios activos en la base de pruebas.
    await dueno.reload();
    await dueno.waitForLoadState("networkidle");
    await dueno
      .getByRole("list", { name: "Usuarios" })
      .getByRole("listitem")
      .filter({ hasText: email })
      .getByRole("button", { name: "Desactivá" })
      .click();
    await dueno
      .getByRole("button", { name: "Desactivar", exact: true })
      .click();
    await expect(
      dueno
        .getByRole("list", { name: "Usuarios" })
        .getByRole("listitem")
        .filter({ hasText: email }),
    ).toContainText("Desactivado", { timeout: 20_000 });
    await sesionDueno.close();
  });

  test("el dueño la abre desde Más y despliega una guía", async ({ page }) => {
    await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await page.getByRole("button", { name: /más/i }).click();
    await irAAyuda(page);

    await page.getByText("Cerrá la caja", { exact: true }).click();
    await expect(page.getByText("Confirmá el cierre").first()).toBeVisible();
    await sinScrollHorizontal(page);
  });
});
