import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { csvRowsToObjects, parseCsv } from "@/lib/csv";
import { validarCsvProductos } from "./schemas";

// El CSV de seed es el que pide la validación de la Fase 3: tiene que pasar entero la vista previa.
describe("supabase/seed/productos.csv", () => {
  it("tiene los 40 productos del seed y todos son válidos", () => {
    const filas = parseCsv(
      readFileSync("supabase/seed/productos.csv", "utf-8"),
    );
    const result = validarCsvProductos(
      csvRowsToObjects(filas),
      filas[0].map((h) => h.trim()),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.filas).toHaveLength(40);
    expect(result.filas.filter((f) => !f.ok)).toEqual([]);
  });
});
