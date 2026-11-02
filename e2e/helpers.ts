import { expect, test, type Page } from "@playwright/test";

// Helpers compartidos de los tests e2e de la venta. Las contraseñas salen solo de variables
// de entorno (nunca del repo): ver supabase/seed_dev_users.sql.

export function passwordDe(name: string): string {
  const value = process.env[name];
  test.skip(
    !value,
    `Falta ${name}: exportá la contraseña del usuario de prueba para correr e2e`,
  );
  return value as string;
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

// Si el usuario todavía no tiene caja abierta, la abre con fondo 0.
export async function abrirCajaSiHaceFalta(page: Page) {
  await page.goto("/vender");
  const abrir = page.getByRole("heading", { name: "Abrí tu caja" });
  if (await abrir.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await page.getByLabel("Fondo inicial del cajón").fill("0");
    await page.getByRole("button", { name: /abrí la caja/i }).click();
  }
  await expect(page.getByLabel("Buscar producto")).toBeVisible({
    timeout: 20_000,
  });
}

// Pausa las promos de prueba "E2E..." que hayan quedado activas en una corrida anterior.
// Corre solo contra la base de pruebas: si una promo E2E queda activa, gana el desempate
// (la más antigua) y la promo del test deja de aplicarse.
export async function pausarPromosDeEnsayo(page: Page) {
  await page.goto("/promociones");
  const pausar = page
    .getByRole("listitem")
    .filter({ hasText: "E2E " })
    .getByRole("button", { name: "Pausar" });
  while ((await pausar.count()) > 0) {
    const antes = await pausar.count();
    await pausar.first().click();
    await expect(pausar).toHaveCount(antes - 1, { timeout: 15_000 });
  }
}
