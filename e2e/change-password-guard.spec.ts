import { expect, test, type Page } from "@playwright/test";

const SESSION_KEY = "demo-pos:mock-session";

const pendingSession = {
  email: "juan.perez@kioskodemo.com",
  rol: "cajero",
  nombre: "Juan Pérez",
  comercio: "Kiosko Demo",
  mustChangePassword: true,
};

const activeSession = {
  email: "admin@kioskodemo.com",
  rol: "dueno",
  nombre: "María López",
  comercio: "Kiosko Demo",
  mustChangePassword: false,
};

async function seedSession(page: Page, session: typeof pendingSession) {
  await page.goto("/login");
  await page.evaluate(([key, value]: [string, string]) => {
    window.sessionStorage.setItem(key, value);
  }, [SESSION_KEY, JSON.stringify(session)]);
}

test.describe("Guard central de contraseña temporal (layout (app))", () => {
  test("mustChangePassword=true no puede quedarse en /vender", async ({ page }) => {
    await seedSession(page, pendingSession);
    await page.goto("/vender");
    await expect(page).toHaveURL(/\/cambiar-contrasena/);
  });

  test("mustChangePassword=true no puede quedarse en /productos", async ({ page }) => {
    await seedSession(page, pendingSession);
    await page.goto("/productos");
    await expect(page).toHaveURL(/\/cambiar-contrasena/);
  });

  test("mustChangePassword=true es redirigido a /cambiar-contrasena", async ({ page }) => {
    await seedSession(page, pendingSession);
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/cambiar-contrasena/);
    await expect(page.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();
  });

  test("mustChangePassword=false mantiene acceso normal", async ({ page }) => {
    await seedSession(page, activeSession);
    await page.goto("/vender");
    await expect(page).toHaveURL(/\/vender/);
    await page.goto("/productos");
    await expect(page).toHaveURL(/\/productos/);
  });
});