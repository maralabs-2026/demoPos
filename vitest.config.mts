import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig usa jsx: preserve (para Next); los tests renderizan componentes.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["src/**/*.test.ts"] },
});
