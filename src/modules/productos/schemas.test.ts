import { describe, expect, it } from "vitest";
import { productoSchema } from "./schemas";

const productoValido = {
  comercioId: "c456a2bd-817c-4b9f-97f4-a1a3d13a71d1",
  nombre: "Gaseosa",
  codigoBarras: "7791234567890",
  categoriaId: "a456a2bd-817c-4b9f-97f4-a1a3d13a71d1",
  costo: 800,
  precio: 1200,
  unidadVenta: "unidad",
  stockMinimo: 5,
};

describe("productoSchema", () => {
  it("accepts a complete product with its commerce, cost and price", () => {
    expect(productoSchema.safeParse(productoValido).success).toBe(true);
  });

  it("rejects a missing or invalid commerce id", () => {
    expect(
      productoSchema.safeParse({ ...productoValido, comercioId: "" }).success,
    ).toBe(false);
  });

  it("rejects a negative cost", () => {
    expect(
      productoSchema.safeParse({ ...productoValido, costo: -1 }).success,
    ).toBe(false);
  });

  it("rejects a negative minimum stock", () => {
    expect(
      productoSchema.safeParse({ ...productoValido, stockMinimo: -1 }).success,
    ).toBe(false);
  });
});