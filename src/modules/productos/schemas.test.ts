import { describe, expect, it } from "vitest";
import { actualizarPreciosSchema, precioActualizado } from "./schemas";

const CATEGORIA = "3f8a1c2e-5b7d-4e9f-8a6b-1c2d3e4f5a6b";

describe("actualizarPreciosSchema", () => {
  it("acepta una categoría y un porcentaje positivo", () => {
    const result = actualizarPreciosSchema.safeParse({ categoriaId: CATEGORIA, porcentaje: 10 });
    expect(result.success).toBe(true);
  });

  it("acepta todo el catálogo (categoría null) y una baja", () => {
    const result = actualizarPreciosSchema.safeParse({ categoriaId: null, porcentaje: -15.5 });
    expect(result.success).toBe(true);
  });

  it("rechaza un porcentaje 0", () => {
    const result = actualizarPreciosSchema.safeParse({ categoriaId: CATEGORIA, porcentaje: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("El porcentaje no puede ser 0");
  });

  it("rechaza porcentajes fuera de rango", () => {
    expect(actualizarPreciosSchema.safeParse({ categoriaId: null, porcentaje: -51 }).success).toBe(
      false,
    );
    expect(actualizarPreciosSchema.safeParse({ categoriaId: null, porcentaje: 201 }).success).toBe(
      false,
    );
  });

  it("rechaza un porcentaje que no es número", () => {
    const result = actualizarPreciosSchema.safeParse({ categoriaId: null, porcentaje: Number.NaN });
    expect(result.success).toBe(false);
  });

  it("rechaza una categoría que no es uuid", () => {
    const result = actualizarPreciosSchema.safeParse({ categoriaId: "bebidas", porcentaje: 10 });
    expect(result.success).toBe(false);
  });
});

describe("precioActualizado", () => {
  it("sube un 10 %", () => {
    expect(precioActualizado(1850, 10)).toBe(2035);
  });

  it("baja un 15 %", () => {
    expect(precioActualizado(1000, -15)).toBe(850);
  });

  it("redondea a centavos como Postgres (medio centavo hacia arriba)", () => {
    // 1234,55 * 1,1 = 1358,005 -> 1358,01
    expect(precioActualizado(1234.55, 10)).toBe(1358.01);
    // 99,99 * 1,033 = 103,28967 -> 103,29
    expect(precioActualizado(99.99, 3.3)).toBe(103.29);
  });
});
