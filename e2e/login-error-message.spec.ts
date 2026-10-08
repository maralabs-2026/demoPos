import { expect, test, type Page } from "@playwright/test";

// E2E contra el login real de Supabase (CA1): el mensaje de credenciales invalidas es el mismo
// exista o no el correo, para no revelar que correos estan dados de alta.
//
// Usuarios de supabase/seed_dev_users.sql: dueno@kiosko.demo (password: E2E_DUENO_PASSWORD).
// Las contrasenas salen solo de variables de entorno: nunca del repo. El test no crea usuarios ni
// modifica datos de Supabase; los dos intentos fallidos no dejan rastro.

const DUENO_EMAIL = "dueno@kiosko.demo";
// Dominio reservado .demo del seed, nunca un correo real.
const NO_EXISTE_EMAIL = "no-existe@kiosko.demo";
const MENSAJE_GENERICO = "Correo o contraseña incorrectos";

function passwordDe(name: string): string {
  const value = process.env[name];
  test.skip(
    !value,
    `Falta ${name}: exporta la contraseña del usuario de prueba para poder correr e2e`,
  );
  return value as string;
}

// Deriva una contrasena incorrecta de la real mutando su ultimo caracter: no hardcodea ninguna
// credencial y sigue siendo distinta aunque la real sea larga (bcrypt solo mira 72 bytes).
function passwordIncorrecta(real: string): string {
  const base = real.slice(0, 60);
  return base.slice(0, -1) + (base.endsWith("a") ? "b" : "a");
}

async function mensajeDeLoginFallido(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: /ingresar/i }).click();

  // Acotado al formulario: Next renderiza un role="alert" propio (next-route-announcer) que
  // siempre esta presente y sin texto, asi que getByRole("alert") sin scope matchea ese.
  const alert = page.locator("form").getByRole("alert");
  // toHaveText reintenta solo: espera a que signInWithPassword resuelva y el mensaje aparezca.
  await expect(alert).toHaveText(MENSAJE_GENERICO);
  return (await alert.textContent())?.trim() ?? "";
}

test.describe("Login sin revelar si el correo existe", () => {
  test("contraseña incorrecta y correo inexistente muestran el mismo mensaje", async ({
    page,
  }) => {
    const password = passwordDe("E2E_DUENO_PASSWORD");

    const conPasswordIncorrecta = await mensajeDeLoginFallido(
      page,
      DUENO_EMAIL,
      passwordIncorrecta(password),
    );
    const conCorreoInexistente = await mensajeDeLoginFallido(
      page,
      NO_EXISTE_EMAIL,
      password,
    );

    expect(conPasswordIncorrecta).toBe(MENSAJE_GENERICO);
    expect(conCorreoInexistente).toBe(MENSAJE_GENERICO);
    expect(conCorreoInexistente).toBe(conPasswordIncorrecta);
  });
});
