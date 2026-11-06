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
  webServer: {
    // En CI se prueba el build de producción (next start), más estable que el dev server.
    command: CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
