import { expect, test, type Page } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Fase 7b: el dueño configura el ticket, los medios de pago y las categorías, y eso se ve al vender.
// Deja todo como estaba: medios y categorías de prueba desactivados o eliminados.

const DUENO = "dueno@kiosko.demo";

async function irA(page: Page, pestana: string) {
  await page
    .getByRole("navigation", { name: "Secciones de configuración" })
    .getByRole("link", { name: pestana })
    .click();
  await page.waitForLoadState("networkidle");
}

test("configuración: ticket, medios de pago y categorías", async ({ page }) => {
  test.setTimeout(120_000);
  const sufijo = Date.now().toString(36);
  const medio = `Cuenta DNI ${sufijo}`;
  const categoria = `Categoría ${sufijo}`;
  const pie = `Volvé pronto ${sufijo}`;

  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/config/ticket");
  await page.waitForLoadState("networkidle");

  // Ticket: guarda y se conserva al recargar. Después vuelve al texto original.
  const campoPie = page.getByLabel("Pie");
  const pieOriginal = await campoPie.inputValue();
  await page.getByLabel("Título").fill("");
  await page.getByRole("button", { name: "Guardá el ticket" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Escribí el título" }),
  ).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await campoPie.fill(pie);
  await page.getByRole("button", { name: "Guardá el ticket" }).click();
  await expect(page.getByText("Ticket guardado").first()).toBeVisible({
    timeout: 20_000,
  });
  await page.reload();
  await expect(campoPie).toHaveValue(pie);
  await page.waitForLoadState("networkidle");
  await campoPie.fill(pieOriginal);
  await page.getByRole("button", { name: "Guardá el ticket" }).click();
  await expect(page.getByText("Ticket guardado").first()).toBeVisible({
    timeout: 20_000,
  });

  // Medio de pago: se crea, se ofrece al cobrar y al desactivarlo deja de ofrecerse.
  await irA(page, "Pagos");
  await page.getByRole("button", { name: "Agregá un medio" }).click();
  const alta = page.getByRole("dialog");
  await alta.getByLabel("Nombre").fill(medio);
  await alta.getByLabel("Tipo").selectOption({ label: "QR" });
  await alta.getByRole("button", { name: "Guardá el medio" }).click();
  await expect(alta).toHaveCount(0, { timeout: 20_000 });

  const lista = page.getByRole("list", { name: "Medios de pago" });
  const fila = lista.getByRole("listitem").filter({ hasText: medio });
  await expect(fila).toContainText("QR");

  // Un nombre repetido no se acepta.
  await page.getByRole("button", { name: "Agregá un medio" }).click();
  const repetido = page.getByRole("dialog");
  await repetido.getByLabel("Nombre").fill(medio.toUpperCase());
  await repetido.getByRole("button", { name: "Guardá el medio" }).click();
  await expect(
    repetido.getByRole("alert").filter({ hasText: "Ya hay un medio" }),
  ).toBeVisible({ timeout: 20_000 });
  await repetido.getByLabel("Cerrar").click();

  await abrirCajaSiHaceFalta(page);
  // Con el ticket vacío, en escritorio los medios de pago están ocultos: se buscan igual.
  await expect(
    page.getByRole("button", { name: medio, includeHidden: true }),
  ).toBeAttached();

  await page.goto("/config/pagos");
  await page.waitForLoadState("networkidle");
  await fila.getByRole("button", { name: "Desactivá" }).click();
  await expect(fila).toContainText("Inactivo", { timeout: 20_000 });

  await abrirCajaSiHaceFalta(page);
  await expect(page.getByRole("button", { name: medio })).toHaveCount(0);

  // Si es el único efectivo activo, no deja desactivarlo.
  await page.goto("/config/pagos");
  await page.waitForLoadState("networkidle");
  const efectivo = lista
    .getByRole("listitem")
    .filter({ hasText: "Efectivo" })
    .filter({ hasNotText: "Inactivo" })
    .first();
  await efectivo.getByRole("button", { name: "Desactivá" }).click();
  await expect(
    page.getByText("Tiene que quedar un medio de efectivo activo").first(),
  ).toBeVisible({ timeout: 20_000 });

  // Categoría: se crea, se renombra y se elimina. Una con productos no se puede.
  await irA(page, "Categorías");
  await page.getByRole("button", { name: "Agregá una categoría" }).click();
  const nueva = page.getByRole("dialog");
  await nueva.getByLabel("Nombre").fill(categoria);
  await nueva.getByRole("button", { name: "Guardá la categoría" }).click();
  await expect(nueva).toHaveCount(0, { timeout: 20_000 });

  const categorias = page.getByRole("list", { name: "Categorías" });
  const filaCategoria = categorias
    .getByRole("listitem")
    .filter({ hasText: categoria });
  await filaCategoria.getByRole("button", { name: "Renombrá" }).click();
  const renombre = page.getByRole("dialog");
  await renombre.getByLabel("Nombre").fill(`${categoria} 2`);
  await renombre.getByRole("button", { name: "Guardá el nombre" }).click();
  await expect(renombre).toHaveCount(0, { timeout: 20_000 });
  await expect(filaCategoria).toContainText(`${categoria} 2`);

  await filaCategoria.getByRole("button", { name: "Eliminá" }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(filaCategoria).toHaveCount(0, { timeout: 20_000 });

  await categorias
    .getByRole("listitem")
    .filter({ hasText: "Bebidas" })
    .getByRole("button", { name: "Eliminá" })
    .click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(
    page.getByText(/Tiene productos o promociones/).first(),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    categorias.getByRole("listitem").filter({ hasText: "Bebidas" }),
  ).toHaveCount(1);
});
