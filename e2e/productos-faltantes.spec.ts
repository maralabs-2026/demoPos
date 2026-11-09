import { expect, test, type Page } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// Filtro de faltantes en /productos y carga de stock desde ahí.
// Requiere correr antes `npm run e2e:preparar` (deja el producto con stock 2 y mínimo 5).

const FALTANTE = "Producto e2e (faltante)";
const AL_DIA = "Coca-Cola 500ml";

function fila(page: Page, nombre: string) {
  return page.getByRole("row").filter({ hasText: nombre }).first();
}

function aviso(page: Page) {
  return page.getByRole("button", { name: /con stock bajo/ });
}

function filtro(page: Page, nombre: RegExp) {
  return page
    .getByRole("group", { name: "Filtrar por stock" })
    .getByRole("button", { name: nombre });
}

async function sinScrollHorizontal(page: Page) {
  const desborde = await page.evaluate(() => {
    const root = document.documentElement;
    const contenedor = document.querySelector('[data-slot="table-container"]');
    return Math.max(
      root.scrollWidth - root.clientWidth,
      contenedor ? contenedor.scrollWidth - contenedor.clientWidth : 0,
    );
  });
  expect(desborde).toBeLessThanOrEqual(0);
}

async function sumarStock(page: Page, cantidad: string) {
  await fila(page, FALTANTE).getByRole("link", { name: "Sumar stock" }).click();
  await expect(page).toHaveURL(/\/stock\?producto=.*desde=faltantes/);
  await page.locator("#stock-cantidad").fill(cantidad);
  await sinScrollHorizontal(page);
  // En celular el botón tiene que poder verse por encima de la barra inferior.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: "Registrá el ingreso" }).click();
  await expect(page.getByText(/Ingreso registrado/)).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("link", { name: "Volver a faltantes" }).click();
  await expect(page).toHaveURL(/\/productos\?stock=faltantes/);
}

test.setTimeout(120_000);

test.describe("en celular", () => {
  test.use({
    viewport: { width: 360, height: 780 },
    hasTouch: true,
    isMobile: true,
  });

  test("el aviso filtra, el filtro se saca y se suma stock", async ({
    page,
  }) => {
    await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await page.goto("/productos");
    await expect(fila(page, AL_DIA)).toBeVisible({ timeout: 20_000 });

    await aviso(page).click();
    await expect(page).toHaveURL(/stock=faltantes/);
    await expect(fila(page, FALTANTE)).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: AL_DIA })).toHaveCount(
      0,
    );
    await sinScrollHorizontal(page);

    const sumar = fila(page, FALTANTE).getByRole("link", {
      name: "Sumar stock",
    });
    const caja = await sumar.boundingBox();
    expect(caja?.height).toBeGreaterThanOrEqual(44);

    await filtro(page, /Sin stock/).click();
    await expect(
      page.getByRole("row").filter({ hasText: FALTANTE }),
    ).toHaveCount(0);
    await filtro(page, /Bajo mínimo/).click();
    await expect(fila(page, FALTANTE)).toBeVisible();

    await filtro(page, /^Todos$/).click();
    await expect(page).not.toHaveURL(/stock=/);
    await expect(fila(page, AL_DIA)).toBeVisible();

    // Una unidad no llega al mínimo: al volver sigue en la lista y con el filtro puesto.
    await aviso(page).click();
    await sumarStock(page, "1");
    await expect(fila(page, FALTANTE)).toBeVisible({ timeout: 20_000 });
    await expect(filtro(page, /Faltantes/)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("en escritorio", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("al llegar al mínimo el producto sale de faltantes", async ({
    page,
  }) => {
    await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await page.goto("/productos?stock=faltantes");
    await expect(fila(page, FALTANTE)).toBeVisible({ timeout: 20_000 });
    await sinScrollHorizontal(page);

    // Con el botón "atrás" del navegador el filtro también sigue puesto.
    await fila(page, FALTANTE)
      .getByRole("link", { name: "Sumar stock" })
      .click();
    await expect(page).toHaveURL(/\/stock\?producto=/);
    await page.goBack();
    await expect(fila(page, FALTANTE)).toBeVisible({ timeout: 20_000 });

    await sumarStock(page, "20");
    await expect(filtro(page, /Faltantes/)).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("row").filter({ hasText: FALTANTE }),
    ).toHaveCount(0);
  });
});
