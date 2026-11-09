import { expect, test, type Page } from "@playwright/test";
import { login, passwordDe } from "./helpers";

// /productos sin deslizar en horizontal: tarjetas en celular y tabla completa en escritorio.

const COCA = "Coca-Cola 500ml";

test.use({
  viewport: { width: 360, height: 780 },
  hasTouch: true,
  isMobile: true,
});

async function sinScrollHorizontal(page: Page) {
  const desborde = await page.evaluate(() => {
    const root = document.documentElement;
    const anchoPagina = root.scrollWidth - root.clientWidth;
    const contenedor = document.querySelector('[data-slot="table-container"]');
    const anchoTabla = contenedor
      ? contenedor.scrollWidth - contenedor.clientWidth
      : 0;
    return Math.max(anchoPagina, anchoTabla);
  });
  expect(desborde).toBeLessThanOrEqual(0);
}

test("dueño: ve precio, stock y costo, y edita sin deslizar", async ({
  page,
}) => {
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/productos");

  const tarjeta = page.getByRole("row").filter({ hasText: COCA }).first();
  await expect(tarjeta).toBeVisible({ timeout: 20_000 });
  await expect(
    tarjeta.getByRole("cell").filter({ hasText: "$" }).first(),
  ).toBeVisible();
  await sinScrollHorizontal(page);

  const editar = tarjeta.getByRole("button", { name: "Editar" });
  await editar.scrollIntoViewIfNeeded();
  await expect(editar).toBeInViewport();
  const caja = await editar.boundingBox();
  expect(caja?.height).toBeGreaterThanOrEqual(44);
  expect((caja?.x ?? 0) + (caja?.width ?? 0)).toBeLessThanOrEqual(360);

  for (const nombre of ["Etiquetas", "Eliminar"]) {
    const accion = await tarjeta
      .getByRole("button", { name: nombre })
      .boundingBox();
    expect((accion?.x ?? 0) + (accion?.width ?? 0)).toBeLessThanOrEqual(360);
  }

  await editar.tap();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test.describe("pantallas con barra lateral", () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
    isMobile: false,
  });

  test("las acciones se alcanzan sin deslizar", async ({ page }) => {
    await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
    await page.goto("/productos");
    const fila = page.getByRole("row").filter({ hasText: COCA }).first();
    await expect(fila).toBeVisible({ timeout: 20_000 });

    for (const width of [1280, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      await sinScrollHorizontal(page);
      await expect(
        fila.getByRole("button", { name: "Eliminar" }),
      ).toBeVisible();
    }
  });
});
