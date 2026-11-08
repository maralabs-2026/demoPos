import { expect, test, type Page } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Bloque 3.3: los ingresos con fecha avisan en el inicio con una cantidad estimada, y el aviso
// desaparece cuando esas unidades se venden. El producto queda en la base de pruebas: tiene
// movimientos. Al terminar no le queda stock, así que no sigue avisando.

const DUENO = "dueno@kiosko.demo";

function enDias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}

function aviso(page: Page, nombre: string) {
  return page
    .getByRole("list", { name: "Pendientes" })
    .getByRole("link")
    .filter({ hasText: nombre });
}

test("vencimientos: avisa lo que vence pronto y deja de avisar cuando se vendió", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const nombre = `E2E vence ${Date.now().toString(36)}`;
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await page.goto("/productos");
  await page.waitForLoadState("networkidle");

  // Alta con stock inicial y vencimiento.
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = page.getByRole("dialog");
  await popup.getByLabel("Nombre del producto *").fill(nombre);
  await popup.getByRole("button", { name: /Generá uno/ }).click();
  const campoCodigo = popup.getByLabel("Código de barras *");
  await expect(campoCodigo).toHaveValue(/^20\d{11}$/, { timeout: 20_000 });
  const codigo = await campoCodigo.inputValue();
  await popup.getByLabel("Precio de venta final *").fill("1000");
  await popup.getByLabel("Cantidad en stock").fill("2");
  await popup.getByLabel("Vence el (opcional)").fill(enDias(10));
  await popup.getByRole("button", { name: /Creá el producto/ }).click();
  await expect(popup).toBeHidden({ timeout: 20_000 });

  // El inicio avisa y lleva a Stock, donde se carga otro ingreso con fecha.
  await page.goto("/inicio");
  await expect(aviso(page, nombre)).toContainText("~2 unidad");
  await expect(aviso(page, nombre)).toContainText("Vence el");
  await aviso(page, nombre).click();
  await expect(page).toHaveURL(/\/stock\?producto=/);
  await page.getByLabel("Cantidad", { exact: true }).fill("1");
  await page.getByLabel("Vence el (opcional)").fill(enDias(10));
  await page.getByRole("button", { name: "Registrá el ingreso" }).click();
  await expect(page.getByText(/Ingreso registrado/)).toBeVisible({
    timeout: 20_000,
  });
  await page.goto("/inicio");
  await expect(aviso(page, nombre)).toContainText("~3 unidad");

  // Con un aviso de 5 días, ese ingreso todavía no avisa.
  await page.goto("/config");
  await page.waitForLoadState("networkidle");
  const dias = page.getByLabel(/días de anticipación/);
  const guardar = page.getByRole("button", {
    name: "Guardá los días de aviso",
  });
  try {
    await dias.fill("5");
    await guardar.click();
    await expect(page.getByText("Días de aviso guardados").first()).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await page.goto("/inicio");
    await expect(page.getByText("Vendido hoy")).toBeVisible();
    await expect(aviso(page, nombre)).toHaveCount(0);
  } finally {
    await page.goto("/config");
    await page.waitForLoadState("networkidle");
    await dias.fill("30");
    await guardar.click();
    await expect(page.getByText("Días de aviso guardados").first()).toBeVisible(
      {
        timeout: 20_000,
      },
    );
  }

  // Vendidas las 3 unidades, deja de avisar.
  await abrirCajaSiHaceFalta(page);
  const buscar = page.getByLabel("Buscar producto");
  for (let i = 0; i < 3; i++) {
    await buscar.fill(codigo);
    await buscar.press("Enter");
  }
  await page.getByLabel("Monto recibido").fill("3000");
  await page.keyboard.press("F2");
  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await page.goto("/inicio");
  await expect(page.getByText("Vendido hoy")).toBeVisible();
  await expect(aviso(page, nombre)).toHaveCount(0);
});
