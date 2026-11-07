import { expect, test, type Locator } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Sube una foto de verdad a Storage en la base de pruebas, la ve en /productos y /vender, y la quita.

const PRODUCTO = "Agua Villavicencio 500ml";
// PNG de 1x1: el navegador lo convierte a JPEG antes de subirlo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function expectFotoCargada(foto: Locator) {
  await foto.scrollIntoViewIfNeeded();
  await expect(foto).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/public\/productos\//,
  );
  await expect
    .poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
}

test("el dueño sube una foto, se ve en el listado y en la venta, y la quita", async ({
  page,
}) => {
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));

  await page.goto("/productos");
  const fila = page.getByRole("row").filter({ hasText: PRODUCTO });
  await fila.getByRole("button", { name: "Editar" }).click();
  // En la PC no se ofrece la cámara: abriría el mismo selector de archivos.
  await expect(page.getByRole("button", { name: "Sacá una foto" })).toHaveCount(
    0,
  );
  await page.getByLabel("Archivo de la imagen").setInputFiles({
    name: "agua.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(
    page.getByRole("button", { name: "Quitá la imagen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Guardá los cambios/ }).click();
  await expect(
    page.getByRole("heading", { name: "Editar producto" }),
  ).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.getByText("pero la foto no")).toHaveCount(0);
  await expectFotoCargada(fila.locator("img"));

  await abrirCajaSiHaceFalta(page);
  await expectFotoCargada(
    page.getByRole("button", { name: new RegExp(PRODUCTO) }).locator("img"),
  );

  await page.goto("/productos");
  await fila.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Quitá la imagen" }).click();
  await page.getByRole("button", { name: /Guardá los cambios/ }).click();
  await expect(fila.locator("img")).toHaveCount(0, { timeout: 15_000 });
});

test.describe("en el celular", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("Sacá una foto abre la cámara trasera y la foto queda en la vista previa", async ({
    page,
  }) => {
    await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await page.goto("/productos");
    await page.getByRole("button", { name: "Nuevo producto" }).click();
    const popup = page.getByRole("dialog");

    // El selector de la cámara pide la trasera directamente.
    await expect(popup.getByLabel("Foto de la cámara")).toHaveAttribute(
      "capture",
      "environment",
    );
    const elegir = page.waitForEvent("filechooser");
    await popup.getByRole("button", { name: "Sacá una foto" }).click();
    const selector = await elegir;
    await selector.setFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: PNG,
    });

    await expect(
      popup.getByRole("button", { name: "Quitá la imagen" }),
    ).toBeVisible();
    await expect(
      popup.getByRole("button", { name: "Cambiá la imagen" }),
    ).toBeVisible();
    await expect(popup.locator('img[src^="blob:"]')).toHaveCount(1);

    // Quitarla limpia la vista previa; cancelar no guarda nada.
    await popup.getByRole("button", { name: "Quitá la imagen" }).click();
    await expect(popup.locator('img[src^="blob:"]')).toHaveCount(0);
    await popup.getByRole("button", { name: "Cancelá" }).click();
    await expect(popup).toBeHidden();
  });
});
