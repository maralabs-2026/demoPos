import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { prepareZXingModule, writeBarcode } from "zxing-wasm/writer";
import { abrirCajaSiHaceFalta, login, passwordDe } from "./helpers";

// Lectura con la cámara simulada: el navegador recibe como "video" un canvas con un código EAN-13
// real, y lo lee el lector de barcode-detector con el .wasm servido desde el sitio.

const COCA = "7790010000154"; // Coca-Cola 500ml en la base de pruebas
const OTRO = "7790895000782";

async function svgDe(codigo: string): Promise<string> {
  prepareZXingModule({
    overrides: {
      wasmBinary: readFileSync(
        "node_modules/zxing-wasm/dist/writer/zxing_writer.wasm",
      ).buffer as ArrayBuffer,
    },
  });
  const r = await writeBarcode(codigo, { format: "EAN13", scale: 4 });
  if (r.error) throw new Error(r.error);
  return r.svg;
}

// Reemplaza la cámara por un canvas que muestra el código. Sin lector nativo, como en iPhone.
async function simularCamara(page: Page, svg: string) {
  await page.addInitScript((svgTexto: string) => {
    delete (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${btoa(svgTexto)}`;
    const dibujar = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 640, 480);
      if (img.complete && img.naturalWidth) {
        const escala = Math.min(
          560 / img.naturalWidth,
          360 / img.naturalHeight,
        );
        const w = img.naturalWidth * escala;
        const h = img.naturalHeight * escala;
        ctx.drawImage(img, (640 - w) / 2, (480 - h) / 2, w, h);
      }
      requestAnimationFrame(dibujar);
    };
    dibujar();
    const medios = navigator.mediaDevices;
    medios.enumerateDevices = async () =>
      [
        {
          kind: "videoinput",
          deviceId: "simulada",
          groupId: "",
          label: "",
          toJSON() {},
        },
      ] as MediaDeviceInfo[];
    medios.getUserMedia = async () => canvas.captureStream(15);
  }, svg);
}

test("cámara: lee el código en la venta y en el popup de producto", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const wasm: string[] = [];
  const cdn: string[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith(".wasm")) wasm.push(`${r.status()} ${r.url()}`);
  });
  page.on("request", (r) => {
    if (/jsdelivr|unpkg/.test(r.url())) cdn.push(r.url());
  });

  await simularCamara(page, await svgDe(COCA));
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
  await abrirCajaSiHaceFalta(page);
  await page.waitForLoadState("networkidle");

  // Venta: el código leído agrega el producto al carrito.
  await page
    .getByRole("button", { name: "Leé el código con la cámara" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("articulos-venta")).toHaveText("1", {
    timeout: 10_000,
  });
  await page.keyboard.press("F4");

  expect(
    wasm.some((w) => /^200 .*\/vendor\/zxing\/zxing_reader\.wasm$/.test(w)),
  ).toBe(true);
  expect(cdn).toEqual([]);

  // Producto: el código leído completa el campo.
  const otra = await page.context().newPage();
  await simularCamara(otra, await svgDe(OTRO));
  await otra.goto("/productos");
  await otra.waitForLoadState("networkidle");
  await otra.getByRole("button", { name: "Nuevo producto" }).click();
  const popup = otra.getByRole("dialog");
  await popup
    .getByRole("button", { name: "Leé el código con la cámara" })
    .click();
  await expect(popup.getByLabel("Código de barras *")).toHaveValue(OTRO, {
    timeout: 30_000,
  });
  await expect(
    otra.getByRole("heading", { name: "Leé el código de barras" }),
  ).toBeHidden();
  await otra.keyboard.press("Escape");
  await expect(
    otra.getByRole("heading", { name: "Agregar producto" }),
  ).toBeHidden();
});

test("cámara: sin permiso avisa y deja escribir el código", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const medios = navigator.mediaDevices;
    medios.enumerateDevices = async () =>
      [
        {
          kind: "videoinput",
          deviceId: "x",
          groupId: "",
          label: "",
          toJSON() {},
        },
      ] as MediaDeviceInfo[];
    medios.getUserMedia = async () => {
      throw new DOMException("denegado", "NotAllowedError");
    };
  });
  await login(page, "dueno@kiosko.demo", passwordDe("E2E_DUENO_PASSWORD"));
  await abrirCajaSiHaceFalta(page);
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: "Leé el código con la cámara" })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("alert").filter({ hasText: "permiso" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrá la cámara" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByLabel("Buscar producto")).toBeEditable();
});
