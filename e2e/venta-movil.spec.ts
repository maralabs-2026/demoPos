import { expect, test } from "@playwright/test";
import {
  abrirCajaSiHaceFalta,
  login,
  passwordDe,
  pausarPromosDeEnsayo,
} from "./helpers";

// La venta en un celular de 360 px: tocar el producto, ver el carrito desde la barra flotante y
// cobrar desde el panel, sin que se abra el teclado al tocar.

const COCA = "Coca-Cola 500ml"; // $ 2.500

test.use({
  viewport: { width: 360, height: 780 },
  hasTouch: true,
  isMobile: true,
});

test("celular: toca un producto, abre el carrito y cobra desde el panel", async ({
  page,
}) => {
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
  await pausarPromosDeEnsayo(page);
  await abrirCajaSiHaceFalta(page);

  const buscar = page.getByLabel("Buscar producto");
  const ticket = page.getByLabel("Ticket");
  const card = page.getByRole("button", { name: new RegExp(COCA) });

  // Sin productos, el ticket no ocupa lugar debajo del catálogo.
  await expect(ticket).toBeHidden();

  // Al entrar no se abre el teclado.
  await expect(buscar).not.toBeFocused();

  // Tocar un producto mientras se busca lo cierra.
  await buscar.tap();
  await expect(buscar).toBeFocused();
  await card.tap();
  await expect(card).toContainText("En el ticket: 1");
  await expect(buscar).not.toBeFocused();

  // La página entra en el ancho: nada queda cortado de costado.
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: /Ver carrito/ }).tap();
  await expect(ticket).toBeVisible();
  await expect(ticket.getByText(COCA)).toBeVisible();
  // El medio de pago se elige en el paso siguiente.
  await expect(page.getByText("Medio de pago")).toBeHidden();

  await ticket.getByRole("button", { name: "Seguí al cobro" }).tap();
  await expect(ticket.getByText("Total a cobrar")).toBeVisible();
  await page.getByLabel("Monto recibido").fill("2500");
  await ticket.getByRole("button", { name: /Confirmá la venta/ }).tap();

  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible({ timeout: 20_000 });
});
