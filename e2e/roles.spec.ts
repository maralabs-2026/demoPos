import { expect, test, type Page } from "@playwright/test";

// Validación de la Fase 2: el guard por rol corre en el servidor, así que entrar por URL a una
// ruta restringida termina en /vender aunque el link no se muestre.
// Usuarios de supabase/seed_dev_users.sql; contraseñas solo por variables de entorno.

function passwordDe(name: string): string {
  const value = process.env[name];
  test.skip(
    !value,
    `Falta ${name}: exportá la contraseña del usuario de prueba para correr e2e`,
  );
  return value as string;
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

test.describe("Acceso por rol", () => {
  test("el dueño entra a /reportes y a /config", async ({ page }) => {
    await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));

    await page.goto("/reportes");
    await expect(page).toHaveURL(/\/reportes$/);
    await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();

    await page.goto("/config");
    await expect(page).toHaveURL(/\/config$/);
    await expect(
      page.getByRole("heading", { name: "Configuración" }),
    ).toBeVisible();
  });

  test("el encargado entra a /reportes pero no a /config", async ({ page }) => {
    await login(
      page,
      "encargado@kiosko.demo",
      passwordDe("E2E_ENCARGADO_PASSWORD"),
    );

    await page.goto("/reportes");
    await expect(page).toHaveURL(/\/reportes$/);

    await page.goto("/config");
    await expect(page).toHaveURL(/\/vender/);
  });
});

// El cajero del seed tiene contraseña temporal: el guard de contraseña lo frena antes que el de
// rol. Igual se prueba que no llega a ninguna de las dos rutas.
test.describe("Cajero", () => {
  test("no accede a /reportes ni a /config", async ({ page }) => {
    await login(page, "cajero@kiosko.demo", passwordDe("E2E_CAJERO_PASSWORD"));

    for (const ruta of ["/reportes", "/config"]) {
      await page.goto(ruta);
      await expect(page).not.toHaveURL(new RegExp(`${ruta}$`));
    }
  });
});
