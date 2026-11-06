import { expect, test } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// El dueño cambia el nombre y sube el logo; se ven en el menú y vuelven a como estaban.
// Los tests SQL buscan el comercio por el nombre "Kiosko Demo": el test lo restaura siempre.

const DUENO = "dueno@kiosko.demo";
const NOMBRE = "Kiosko Demo";

// PNG de 2×1 píxeles, generado para el test.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGPQj/76X0BA4D8AEEYDri/I0jgAAAAASUVORK5CYII=",
  "base64",
);

test("comercio: el dueño cambia el nombre y el logo, y se ven en el menú", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/config");
  await page.waitForLoadState("networkidle");

  const menu = page.getByRole("complementary");
  const campoNombre = page.getByLabel("Nombre del comercio");
  const guardarNombre = page.getByRole("button", { name: "Guardá el nombre" });

  try {
    // Nombre: vacío no; uno nuevo se ve en el menú.
    await campoNombre.fill(" ");
    await guardarNombre.click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Escribí el nombre" }),
    ).toBeVisible({ timeout: 20_000 });

    await campoNombre.fill("Zona 24/7");
    await guardarNombre.click();
    await expect(page.getByText("Nombre guardado").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(menu).toContainText("Zona 24/7", { timeout: 20_000 });

    // Logo: un archivo que no es imagen se rechaza aunque se llame .png.
    const archivo = page.getByLabel("Archivo del logo");
    await archivo.setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: Buffer.from("no soy una imagen"),
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "PNG, JPG o WebP" }),
    ).toBeVisible({ timeout: 20_000 });

    await archivo.setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(page.getByText("Logo guardado").first()).toBeVisible({
      timeout: 20_000,
    });
    // Con logo, el menú muestra la imagen con el nombre como texto alternativo.
    await expect(menu.getByRole("img", { name: "Zona 24/7" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("img", { name: "Logo de Zona 24/7" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Quitá el logo" }).click();
    await expect(page.getByText("Logo quitado").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(menu.getByRole("img")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText("Todavía no hay logo.")).toBeVisible();
  } finally {
    await page.goto("/config");
    await page.waitForLoadState("networkidle");
    if ((await campoNombre.inputValue()) !== NOMBRE) {
      await campoNombre.fill(NOMBRE);
      await guardarNombre.click();
      await expect(page.getByText("Nombre guardado").first()).toBeVisible({
        timeout: 20_000,
      });
    }
    const quitar = page.getByRole("button", { name: "Quitá el logo" });
    if (await quitar.isVisible()) {
      await quitar.click();
      await expect(page.getByText("Logo quitado").first()).toBeVisible({
        timeout: 20_000,
      });
    }
  }
  await expect(menu).toContainText(NOMBRE);
});
