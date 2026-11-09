import { defineConfig } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  // Un solo worker: todos los tests comparten la base de pruebas (promos, combos, stock y caja).
  // En paralelo, las promos y combos de un test cambian el ticket de otro, y el dev server corta
  // conexiones bajo carga.
  workers: 1,
  // En CI, un reintento separa un fallo real de una demora de la red; el reporte marca el test
  // como "flaky" si pasó al segundo intento.
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: CI ? "retain-on-failure" : "off",
  },
  webServer: [
    {
      // Reemplaza a la API de Mercado Pago; ver e2e/mp-falso.mjs.
      command: "node e2e/mp-falso.mjs",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: !CI,
    },
    {
      // En CI se prueba el build de producción (next start), más estable que el dev server.
      command: CI ? "npm run start" : "npm run dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: {
        MERCADOPAGO_ACCESS_TOKEN: "token-e2e",
        MERCADOPAGO_API_URL: "http://127.0.0.1:4010",
      },
    },
  ],
});
