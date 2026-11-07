import { expect, test, type Page } from "@playwright/test";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Bloque 3.2b: con la red cortada se sigue cobrando; la venta queda en el dispositivo y se envía
// sola cuando vuelve la conexión. Con ventas sin enviar, la caja no se cierra.

const DUENO = "dueno@kiosko.demo";
const COCA = "7790010000154"; // Coca-Cola 500ml, $ 2.500 (e2e:preparar le deja stock)

type Registro = {
  venta: { ventaId: string; cajaId: string };
  estado: string;
};

// La cola vive en IndexedDB (src/lib/cola-ventas.ts).
function leerCola(page: Page): Promise<Registro[]> {
  return page.evaluate(
    () =>
      new Promise<Registro[]>((resolve, reject) => {
        const pedido = indexedDB.open("pos-ventas", 1);
        pedido.onupgradeneeded = () =>
          pedido.result.createObjectStore("cola", { keyPath: "venta.ventaId" });
        pedido.onerror = () => reject(pedido.error);
        pedido.onsuccess = () => {
          const db = pedido.result;
          const todo = db.transaction("cola").objectStore("cola").getAll();
          todo.onsuccess = () => {
            resolve(todo.result as Registro[]);
            db.close();
          };
        };
      }),
  );
}

function escribirCola(page: Page, registro: Registro | null, borrar?: string) {
  return page.evaluate(
    ({ registro, borrar }) =>
      new Promise<void>((resolve, reject) => {
        const pedido = indexedDB.open("pos-ventas", 1);
        pedido.onerror = () => reject(pedido.error);
        pedido.onsuccess = () => {
          const db = pedido.result;
          const tx = db.transaction("cola", "readwrite");
          if (registro) tx.objectStore("cola").put(registro);
          if (borrar) tx.objectStore("cola").delete(borrar);
          tx.oncomplete = () => {
            db.close();
            window.dispatchEvent(new Event("pos:cola-ventas"));
            resolve();
          };
        };
      }),
    { registro, borrar },
  );
}

test("sin conexión: cobra, guarda la venta y la envía sola al volver internet", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await login(page, DUENO, passwordDe("E2E_DUENO_PASSWORD"));
  await abrirCajaSiHaceFalta(page);
  expect(await leerCola(page)).toHaveLength(0);

  // Se corta la red con la pantalla abierta.
  await context.setOffline(true);
  await expect(page.getByText("Sin conexión", { exact: true })).toBeVisible();

  const buscar = page.getByLabel("Buscar producto");
  await buscar.fill(COCA);
  await buscar.press("Enter");
  await page.getByLabel("Monto recibido").fill("3000");
  await page.keyboard.press("F2");

  await expect(
    page.getByRole("heading", { name: "Venta cobrada" }),
  ).toBeVisible();
  await expect(page.getByText("Cobrada sin conexión")).toBeVisible();
  await expect(page.getByText("1 venta por enviar")).toBeVisible();

  const cola = await leerCola(page);
  expect(cola).toHaveLength(1);
  expect(cola[0].estado).toBe("pendiente");
  const { ventaId, cajaId } = cola[0].venta;

  // Vuelve la red: la venta se envía sola y sale de la cola.
  await context.setOffline(false);
  await expect(page.getByText("1 venta por enviar")).toBeHidden({
    timeout: 45_000,
  });
  await expect.poll(() => leerCola(page), { timeout: 20_000 }).toHaveLength(0);

  // Quedó registrada con el id del dispositivo, una sola vez, con lo que se cobró.
  await page.goto(`/reportes/ventas/${ventaId}`);
  await expect(page.locator("main")).toContainText("Coca-Cola 500ml");
  await expect(page.locator("main")).toContainText("$ 2.500,00");

  // Con una venta de esta caja sin enviar, el cierre se bloquea en este dispositivo.
  await page.goto("/caja");
  const cerrar = page.getByRole("button", { name: "Cerrá la caja" });
  await expect(cerrar).toBeEnabled();
  await escribirCola(page, {
    ...cola[0],
    venta: { ...cola[0].venta, ventaId: crypto.randomUUID(), cajaId },
  });
  await expect(page.getByText("todavía no se envió")).toBeVisible();
  await expect(cerrar).toBeDisabled();
  const [falsa] = await leerCola(page);
  await escribirCola(page, null, falsa.venta.ventaId);
  await expect(cerrar).toBeEnabled();
});
