import { expect, test, type Page } from "@playwright/test";

// E2E contra el login real de Supabase. Usuarios de supabase/seed_dev_users.sql:
//   dueno@kiosko.demo   -> sin must_change_password   (password: E2E_DUENO_PASSWORD)
//   cajero@kiosko.demo  -> con must_change_password   (password: E2E_CAJERO_PASSWORD)
// Las contraseñas salen solo de variables de entorno: nunca del repo. Sin sesion sembrada
// (no hay mock) y sin sesionStorage.
//
// Precondicion manual, igual que CA4: antes de correr este archivo, cajero@kiosko.demo tiene
// que tener {"must_change_password": true} en user_metadata. El test no lo setea ni lo limpia.

const DUENO_EMAIL = "dueno@kiosko.demo";
const CAJERO_EMAIL = "cajero@kiosko.demo";

function passwordDe(name: string): string {
  const value = process.env[name];
  test.skip(
    !value,
    `Falta ${name}: exporta la contraseña del usuario de prueba para poder correr e2e`,
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

test.describe("Guard de contraseña temporal con autenticación real", () => {
  test("usuario con must_change_password=true es enviado a /cambiar-contrasena", async ({
    page,
  }) => {
    const password = passwordDe("E2E_CAJERO_PASSWORD");
    await login(page, CAJERO_EMAIL, password);

    await expect(page).toHaveURL(/\/cambiar-contrasena/);
    await expect(page.getByRole("heading", { name: /cambiar contraseña/i })).toBeVisible();
  });

  test("usuario con must_change_password=true no puede quedarse en /vender", async ({
    page,
  }) => {
    const password = passwordDe("E2E_CAJERO_PASSWORD");
    await login(page, CAJERO_EMAIL, password);

    await page.goto("/vender");
    await expect(page).toHaveURL(/\/cambiar-contrasena/);
  });

  test("usuario sin flag entra a /vender y /productos", async ({ page }) => {
    const password = passwordDe("E2E_DUENO_PASSWORD");
    await login(page, DUENO_EMAIL, password);

    await expect(page).toHaveURL(/\/vender/);
    await page.goto("/productos");
    await expect(page).toHaveURL(/\/productos/);
  });

  test("cerrar sesión vuelve a /login", async ({ page }) => {
    const password = passwordDe("E2E_DUENO_PASSWORD");
    await login(page, DUENO_EMAIL, password);

    await page.goto("/perfil");
    await page.getByRole("button", { name: /cerrar sesión/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
