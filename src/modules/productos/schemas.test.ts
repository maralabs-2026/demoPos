import { describe, expect, it } from "vitest";
import {
  CSV_COLUMNAS,
  CSV_MAX_FILAS,
  actualizarPreciosSchema,
  calcularMargen,
  precioActualizado,
  productoSchema,
  validarCsvProductos,
} from "./schemas";

const CATEGORIA = "3f8a1c2e-5b7d-4e9f-8a6b-1c2d3e4f5a6b";

describe("actualizarPreciosSchema", () => {
  it("acepta una categoría y un porcentaje positivo", () => {
    const result = actualizarPreciosSchema.safeParse({
      categoriaId: CATEGORIA,
      porcentaje: 10,
    });
    expect(result.success).toBe(true);
  });

  it("acepta todo el catálogo (categoría null) y una baja", () => {
    const result = actualizarPreciosSchema.safeParse({
      categoriaId: null,
      porcentaje: -15.5,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un porcentaje 0", () => {
    const result = actualizarPreciosSchema.safeParse({
      categoriaId: CATEGORIA,
      porcentaje: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "El porcentaje no puede ser 0",
    );
  });

  it("rechaza porcentajes fuera de rango", () => {
    expect(
      actualizarPreciosSchema.safeParse({ categoriaId: null, porcentaje: -51 })
        .success,
    ).toBe(false);
    expect(
      actualizarPreciosSchema.safeParse({ categoriaId: null, porcentaje: 201 })
        .success,
    ).toBe(false);
  });

  it("rechaza un porcentaje que no es número", () => {
    const result = actualizarPreciosSchema.safeParse({
      categoriaId: null,
      porcentaje: Number.NaN,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una categoría que no es uuid", () => {
    const result = actualizarPreciosSchema.safeParse({
      categoriaId: "bebidas",
      porcentaje: 10,
    });
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

const productoValido = {
  nombre: "Gaseosa",
  codigoBarras: "7791234567890",
  categoriaId: CATEGORIA,
  costo: 800,
  precio: 1200,
  unidadVenta: "unidad",
  stockMinimo: 5,
};

describe("productoSchema", () => {
  it("acepta un producto completo con costo y precio", () => {
    expect(productoSchema.safeParse(productoValido).success).toBe(true);
  });

  it("acepta un producto sin costo conocido", () => {
    expect(
      productoSchema.safeParse({ ...productoValido, costo: null }).success,
    ).toBe(true);
  });

  it("recorta espacios del nombre y del código", () => {
    const result = productoSchema.safeParse({
      ...productoValido,
      nombre: "  Gaseosa  ",
      codigoBarras: " 7791234567890 ",
    });
    expect(result.data?.nombre).toBe("Gaseosa");
    expect(result.data?.codigoBarras).toBe("7791234567890");
  });

  it("rechaza un nombre vacío", () => {
    const result = productoSchema.safeParse({
      ...productoValido,
      nombre: "   ",
    });
    expect(result.error?.issues[0]?.message).toBe("El nombre es obligatorio");
  });

  it("rechaza un costo o un precio negativo", () => {
    expect(
      productoSchema.safeParse({ ...productoValido, costo: -1 }).success,
    ).toBe(false);
    expect(
      productoSchema.safeParse({ ...productoValido, precio: -1 }).success,
    ).toBe(false);
  });

  it("rechaza un precio que no es número", () => {
    expect(
      productoSchema.safeParse({ ...productoValido, precio: Number.NaN })
        .success,
    ).toBe(false);
  });

  it("rechaza un stock mínimo negativo o con decimales", () => {
    expect(
      productoSchema.safeParse({ ...productoValido, stockMinimo: -1 }).success,
    ).toBe(false);
    expect(
      productoSchema.safeParse({ ...productoValido, stockMinimo: 1.5 }).success,
    ).toBe(false);
  });

  it("acepta un producto sin categoría", () => {
    expect(
      productoSchema.safeParse({ ...productoValido, categoriaId: null })
        .success,
    ).toBe(true);
  });

  it("rechaza una categoría que no es uuid", () => {
    const result = productoSchema.safeParse({
      ...productoValido,
      categoriaId: "",
    });
    expect(result.error?.issues[0]?.message).toBe("Seleccioná una categoría");
  });

  it("ignora un comercioId enviado desde el cliente", () => {
    const result = productoSchema.safeParse({
      ...productoValido,
      comercioId: CATEGORIA,
    });
    expect(result.data).not.toHaveProperty("comercioId");
  });
});

describe("calcularMargen", () => {
  it("calcula el margen bruto sobre el precio", () => {
    expect(calcularMargen(800, 1200)).toBeCloseTo(33.33, 2);
  });

  it("da negativo si se vende por debajo del costo", () => {
    expect(calcularMargen(1500, 1200)).toBeCloseTo(-25, 2);
  });

  it("devuelve null sin costo o con precio 0", () => {
    expect(calcularMargen(null, 1200)).toBeNull();
    expect(calcularMargen(800, 0)).toBeNull();
  });
});

const FILA_CSV = {
  nombre: "Yerba Playadito 1 kg",
  categoria: "Almacén",
  codigo_barras: "7790387000013",
  costo: "3.100,00",
  precio: "4.250,50",
  unidad_venta: "unidad",
  stock_minimo: "6",
};

const validar = (filas: Record<string, string>[]) =>
  validarCsvProductos(filas, [...CSV_COLUMNAS]);

describe("validarCsvProductos", () => {
  it("convierte una fila válida con montos en formato argentino", () => {
    expect(validar([FILA_CSV])).toEqual({
      ok: true,
      filas: [
        {
          numero: 2,
          ok: true,
          producto: {
            nombre: "Yerba Playadito 1 kg",
            categoria: "Almacén",
            codigoBarras: "7790387000013",
            costo: 3100,
            precio: 4250.5,
            unidadVenta: "unidad",
            stockMinimo: 6,
          },
        },
      ],
    });
  });

  it("deja costo y categoría en null cuando vienen vacíos", () => {
    const result = validar([{ ...FILA_CSV, costo: "", categoria: " " }]);
    if (!result.ok || !result.filas[0].ok) throw new Error("debía validar");
    expect(result.filas[0].producto).toMatchObject({
      costo: null,
      categoria: null,
    });
  });

  it("marca la fila con sus errores y conserva los datos para la vista previa", () => {
    const result = validar([
      FILA_CSV,
      {
        ...FILA_CSV,
        codigo_barras: "7790387000020",
        precio: "abc",
        stock_minimo: "1,5",
      },
    ]);
    if (!result.ok) throw new Error("debía validar el archivo");
    expect(result.filas[0].ok).toBe(true);
    expect(result.filas[1]).toMatchObject({
      numero: 3,
      ok: false,
      datos: { precio: "abc" },
      errores: [
        "El precio no es un monto válido",
        "El stock mínimo debe ser un número entero",
      ],
    });
  });

  it("exige el precio y aplica las reglas del ABM después de convertir", () => {
    const sinPrecio = validar([{ ...FILA_CSV, precio: "" }]);
    if (!sinPrecio.ok || sinPrecio.filas[0].ok) throw new Error("debía fallar");
    expect(sinPrecio.filas[0].errores).toEqual(["Falta el precio"]);

    const reglasAbm = validar([
      { ...FILA_CSV, nombre: "  ", stock_minimo: "-1" },
    ]);
    if (!reglasAbm.ok || reglasAbm.filas[0].ok) throw new Error("debía fallar");
    expect(reglasAbm.filas[0].errores).toEqual([
      "El nombre es obligatorio",
      "El stock mínimo no puede ser negativo",
    ]);
  });

  it("rechaza un código de barras repetido dentro del archivo", () => {
    const result = validar([FILA_CSV, { ...FILA_CSV, nombre: "Otra yerba" }]);
    if (!result.ok) throw new Error("debía validar el archivo");
    expect(result.filas[1]).toMatchObject({
      numero: 3,
      ok: false,
      errores: ["El código 7790387000013 ya aparece en la fila 2"],
    });
  });

  it("rechaza el archivo si faltan columnas", () => {
    expect(validarCsvProductos([FILA_CSV], ["nombre", "precio"])).toEqual({
      ok: false,
      error:
        "Faltan columnas en el archivo: categoria, codigo_barras, costo, unidad_venta, stock_minimo",
    });
  });

  it("rechaza un archivo vacío o con demasiadas filas", () => {
    expect(validar([])).toEqual({
      ok: false,
      error: "El archivo no tiene productos",
    });
    const muchas = Array.from({ length: CSV_MAX_FILAS + 1 }, () => FILA_CSV);
    expect(validar(muchas).ok).toBe(false);
  });
});
