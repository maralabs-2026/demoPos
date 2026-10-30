import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Un solo worker: todos los tests comparten la base de pruebas (promos, combos, stock y caja).
  // En paralelo, las promos y combos de un test cambian el ticket de otro, y el dev server corta
  // conexiones bajo carga.
  workers: 1,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
