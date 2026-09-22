import { describe, expect, it } from "vitest";
import {
  calcularMargen,
  codigoBarrasSchema,
  csvProductoRowSchema,
  productoFormSchema,
  tieneDigitoVerificadorValido,
} from "./schemas";

describe("tieneDigitoVerificadorValido", () => {
  it("acepta un EAN-13 real y válido", () => {
    expect(tieneDigitoVerificadorValido("4006381333931")).toBe(true);
  });

  it("acepta los códigos generados para el seed de la demo", () => {
    expect(tieneDigitoVerificadorValido("7790010000017")).toBe(true);
    expect(tieneDigitoVerificadorValido("7790010000406")).toBe(true);
  });

  it("rechaza un código con el último dígito alterado", () => {
    expect(tieneDigitoVerificadorValido("7790010000018")).toBe(false);
  });

  it("rechaza un código con un dígito del medio alterado", () => {
    expect(tieneDigitoVerificadorValido("7790010000917")).toBe(false);
  });

  it("rechaza largos no soportados", () => {
    expect(tieneDigitoVerificadorValido("12345")).toBe(false);
  });

  it("rechaza texto no numérico", () => {
    expect(tieneDigitoVerificadorValido("779001000001A")).toBe(false);
  });
});

describe("codigoBarrasSchema", () => {
  it("recorta espacios y acepta un código válido", () => {
    expect(codigoBarrasSchema.safeParse(" 7790010000017 ").success).toBe(true);
  });

  it("rechaza un código con el dígito verificador incorrecto", () => {
    const result = codigoBarrasSchema.safeParse("7790010000018");
    expect(result.success).toBe(false);
  });
});

describe("productoFormSchema", () => {
  const base = {
    nombre: "Coca-Cola 500ml",
    categoriaId: "11111111-1111-4111-8111-111111111111",
    codigoBarras: "7790010000154",
    precio: 2500,
    unidadVenta: "unidad" as const,
    stockMinimo: 15,
  };

  it("acepta datos válidos sin costo", () => {
    expect(productoFormSchema.safeParse(base).success).toBe(true);
  });

  it("acepta costo vacío como 'no cargado', no como 0", () => {
    const result = productoFormSchema.safeParse({ ...base, costo: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.costo).toBeUndefined();
  });

  it("rechaza nombre vacío", () => {
    expect(productoFormSchema.safeParse({ ...base, nombre: "" }).success).toBe(
      false,
    );
  });

  it("rechaza precio 0 o negativo", () => {
    expect(productoFormSchema.safeParse({ ...base, precio: 0 }).success).toBe(
      false,
    );
    expect(productoFormSchema.safeParse({ ...base, precio: -10 }).success).toBe(
      false,
    );
  });

  it("rechaza costo negativo", () => {
    expect(productoFormSchema.safeParse({ ...base, costo: -1 }).success).toBe(
      false,
    );
  });

  it("rechaza stock mínimo negativo o no entero", () => {
    expect(
      productoFormSchema.safeParse({ ...base, stockMinimo: -1 }).success,
    ).toBe(false);
    expect(
      productoFormSchema.safeParse({ ...base, stockMinimo: 1.5 }).success,
    ).toBe(false);
  });

  it("rechaza categoriaId que no es uuid", () => {
    expect(
      productoFormSchema.safeParse({ ...base, categoriaId: "no-es-uuid" })
        .success,
    ).toBe(false);
  });
});

describe("calcularMargen", () => {
  it("calcula el margen sobre el precio de venta", () => {
    expect(calcularMargen(2500, 1500)).toBeCloseTo(40);
  });

  it("devuelve null si no hay costo cargado", () => {
    expect(calcularMargen(2500, undefined)).toBeNull();
  });

  it("devuelve null si el precio es 0", () => {
    expect(calcularMargen(0, 100)).toBeNull();
  });

  it("permite margen negativo (venta a pérdida)", () => {
    expect(calcularMargen(1000, 1500)).toBeCloseTo(-50);
  });
});

describe("csvProductoRowSchema", () => {
  const filaValida = {
    nombre: "Coca-Cola 500ml",
    categoria: "Bebidas",
    codigo_barras: "7790010000154",
    costo: "1500",
    precio: "2500",
    unidad_venta: "unidad",
    stock_minimo: "15",
  };

  it("acepta una fila válida y convierte los números", () => {
    const result = csvProductoRowSchema.safeParse(filaValida);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.precio).toBe(2500);
      expect(result.data.costo).toBe(1500);
      expect(result.data.stock_minimo).toBe(15);
    }
  });

  it("rechaza un precio no numérico", () => {
    expect(
      csvProductoRowSchema.safeParse({
        ...filaValida,
        precio: "no es un número",
      }).success,
    ).toBe(false);
  });

  it("rechaza una unidad_venta fuera del enum", () => {
    expect(
      csvProductoRowSchema.safeParse({ ...filaValida, unidad_venta: "docena" })
        .success,
    ).toBe(false);
  });

  it("rechaza un código de barras inválido", () => {
    expect(
      csvProductoRowSchema.safeParse({ ...filaValida, codigo_barras: "123" })
        .success,
    ).toBe(false);
  });

  it("rechaza fila sin categoría", () => {
    expect(
      csvProductoRowSchema.safeParse({ ...filaValida, categoria: "" }).success,
    ).toBe(false);
  });
});
