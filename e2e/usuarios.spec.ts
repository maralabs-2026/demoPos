import { expect, test, type Page } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// Fase 7a: el dueño crea un usuario, que entra con contraseña temporal y debe cambiarla; se blanquea,
// se desactiva y deja de poder ingresar. Crea usuarios reales: necesita la service role de test.

const DUENO = "dueno@kiosko.demo";
const ENCARGADO = "encargado@kiosko.demo";

function filaDe(page: Page, email: string) {
  return page
    .getByRole("list", { name: "Usuarios" })
    .getByRole("listitem")
    .filter({ hasText: email });
}

test("usuarios: alta, primer ingreso, blanqueo, desactivación y reactivación", async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Falta SUPABASE_SERVICE_ROLE_KEY de test en .env.e2e.local",
  );
  test.setTimeout(180_000);

  const email = `e2e-${Date.now().toString(36)}@test.invalid`;
  const temporal = "temporal-e2e-123";
  const definitiva = "definitiva-e2e-456";
  const blanqueada = "blanqueada-e2e-789";

  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/usuarios");
  await page.waitForLoadState("networkidle");

  // Datos inválidos: no llega a crear nada.
  await page.getByRole("button", { name: "Creá un usuario" }).click();
  const alta = page.getByRole("dialog");
  await alta.getByRole("button", { name: "Creá el usuario" }).click();
  await expect(
    alta.getByRole("alert").filter({ hasText: "Escribí el nombre" }),
  ).toBeVisible();

  await alta.getByLabel("Nombre").fill("Cajero e2e");
  await alta.getByLabel("Correo").fill(email);
  await alta.getByLabel("Rol").selectOption({ label: "Cajero" });
  await alta.getByLabel("Contraseña temporal").fill(temporal);
  await alta.getByRole("button", { name: "Creá el usuario" }).click();
  await expect(alta).toHaveCount(0, { timeout: 20_000 });
  await expect(filaDe(page, email)).toContainText("Contraseña temporal");

  // El mismo correo no se puede usar dos veces.
  await page.getByRole("button", { name: "Creá un usuario" }).click();
  const repetido = page.getByRole("dialog");
  await repetido.getByLabel("Nombre").fill("Repetido");
  await repetido.getByLabel("Correo").fill(email);
  await repetido.getByLabel("Contraseña temporal").fill(temporal);
  await repetido.getByRole("button", { name: "Creá el usuario" }).click();
  await expect(
    repetido.getByRole("alert").filter({ hasText: "no se puede usar" }),
  ).toBeVisible({ timeout: 20_000 });
  await repetido.getByLabel("Cerrar").click();

  // Primer ingreso, en otra sesión: no pasa de cambiar la contraseña, y después llega a vender.
  const sesion = await browser.newContext();
  const pagina = await sesion.newPage();
  await login(pagina, email, temporal);
  await expect(pagina).toHaveURL(/\/cambiar-contrasena/);
  await pagina.goto("/vender");
  await expect(pagina).toHaveURL(/\/cambiar-contrasena/);
  await pagina.waitForLoadState("networkidle");
  await pagina.getByLabel("Nueva contraseña", { exact: true }).fill(definitiva);
  await pagina.getByLabel(/Confirm/i).fill(definitiva);
  await pagina.getByRole("button", { name: /cambiar|guardar/i }).click();
  await expect(pagina).not.toHaveURL(/\/cambiar-contrasena/, {
    timeout: 20_000,
  });
  // Es cajero: no entra a usuarios.
  await pagina.goto("/usuarios");
  await expect(pagina).toHaveURL(/\/vender/);

  // Blanqueo: la anterior deja de servir y la temporal obliga a cambiarla.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await filaDe(page, email).getByRole("button", { name: "Blanqueá" }).click();
  const blanqueo = page.getByRole("dialog");
  await blanqueo.getByLabel("Contraseña temporal").fill(blanqueada);
  await blanqueo.getByRole("button", { name: "Confirmá el blanqueo" }).click();
  await expect(blanqueo).toHaveCount(0, { timeout: 20_000 });
  await expect(filaDe(page, email)).toContainText("Contraseña temporal");

  // Desactivar: la sesión abierta pierde el acceso y no puede volver a ingresar.
  await filaDe(page, email).getByRole("button", { name: "Desactivá" }).click();
  await page.getByRole("button", { name: "Desactivar", exact: true }).click();
  await expect(filaDe(page, email)).toContainText("Desactivado", {
    timeout: 20_000,
  });
  await pagina.goto("/vender");
  await expect(pagina).toHaveURL(/\/login/, { timeout: 20_000 });
  await pagina.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await pagina.getByLabel("Contraseña", { exact: true }).fill(blanqueada);
  await pagina.getByRole("button", { name: /ingresar/i }).click();
  await expect(
    pagina.getByRole("alert").filter({ hasText: "Correo o contraseña" }),
  ).toBeVisible({ timeout: 20_000 });

  // Reactivar devuelve el ingreso, con la temporal.
  await filaDe(page, email).getByRole("button", { name: "Reactivá" }).click();
  await page.getByRole("button", { name: "Reactivar", exact: true }).click();
  await expect(filaDe(page, email)).not.toContainText("Desactivado", {
    timeout: 20_000,
  });
  await login(pagina, email, blanqueada);
  await expect(pagina).toHaveURL(/\/cambiar-contrasena/);
  await sesion.close();

  // Lo deja desactivado, para no acumular usuarios activos en test.
  await filaDe(page, email).getByRole("button", { name: "Desactivá" }).click();
  await page.getByRole("button", { name: "Desactivar", exact: true }).click();
  await expect(filaDe(page, email)).toContainText("Desactivado", {
    timeout: 20_000,
  });
});

test("usuarios: el encargado solo administra cajeros y nadie se administra a sí mismo", async ({
  page,
}) => {
  await login(page, ENCARGADO, passwordDe("E2E_ENCARGADO_PASSWORD"));
  await page.goto("/usuarios");
  await page.waitForLoadState("networkidle");

  // Sobre el dueño y sobre sí mismo no hay acciones; sobre el cajero, sí.
  const acciones = (email: string) =>
    filaDe(page, email).getByRole("button", { name: "Editá" });
  await expect(acciones(DUENO)).toHaveCount(0);
  await expect(acciones(ENCARGADO)).toHaveCount(0);
  await expect(acciones("cajero@kiosko.demo")).toHaveCount(1);

  // Solo puede crear cajeros.
  await page.getByRole("button", { name: "Creá un usuario" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Rol").getByRole("option"),
  ).toHaveText(["Cajero"]);
});
