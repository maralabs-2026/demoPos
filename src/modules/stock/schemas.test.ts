import { describe, expect, it } from "vitest";
import { ajusteSchema, cantidadConSigno, ingresoSchema } from "./schemas";

const productoId = "8f14e45f-ceea-467f-a0e6-1b2c3d4e5f60";

describe("ingresoSchema", () => {
  it("acepta una cantidad entera positiva sin detalle", () => {
    const r = ingresoSchema.safeParse({ productoId, cantidad: 12 });
    expect(r.success).toBe(true);
    expect(r.data?.motivo).toBeUndefined();
  });

  it("recorta el detalle y lo descarta si queda vacío", () => {
    expect(
      ingresoSchema.parse({
        productoId,
        cantidad: 1,
        motivo: "  Remito 0001-123 ",
      }).motivo,
    ).toBe("Remito 0001-123");
    expect(
      ingresoSchema.parse({ productoId, cantidad: 1, motivo: "   " }).motivo,
    ).toBeUndefined();
  });

  it.each([0, -3, 1.5, 100001])("rechaza la cantidad %s", (cantidad) => {
    expect(ingresoSchema.safeParse({ productoId, cantidad }).success).toBe(
      false,
    );
  });

  it("rechaza un producto que no es uuid", () => {
    expect(
      ingresoSchema.safeParse({ productoId: "abc", cantidad: 1 }).success,
    ).toBe(false);
  });
});

describe("ajusteSchema", () => {
  it("exige motivo", () => {
    const r = ajusteSchema.safeParse({
      productoId,
      sentido: "restar",
      cantidad: 2,
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Escribí el motivo del ajuste");
  });

  it("rechaza un motivo de menos de 3 caracteres después de recortar", () => {
    const r = ajusteSchema.safeParse({
      productoId,
      sentido: "restar",
      cantidad: 2,
      motivo: "  a ",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza un motivo de más de 200 caracteres", () => {
    const motivo = "x".repeat(201);
    expect(
      ajusteSchema.safeParse({
        productoId,
        sentido: "sumar",
        cantidad: 1,
        motivo,
      }).success,
    ).toBe(false);
  });

  it("rechaza un sentido desconocido", () => {
    expect(
      ajusteSchema.safeParse({
        productoId,
        sentido: "poner",
        cantidad: 1,
        motivo: "Conteo",
      }).success,
    ).toBe(false);
  });
});

describe("cantidadConSigno", () => {
  it("resta en negativo y suma en positivo", () => {
    const base = { productoId, cantidad: 3, motivo: "Vencido" };
    expect(
      cantidadConSigno(ajusteSchema.parse({ ...base, sentido: "restar" })),
    ).toBe(-3);
    expect(
      cantidadConSigno(ajusteSchema.parse({ ...base, sentido: "sumar" })),
    ).toBe(3);
  });
});

describe("vencimiento en ingresoSchema", () => {
  const ingreso = {
    productoId: "4b9a2d3f-6c8e-4f0a-9b7c-2d3e4f5a6b7c",
    cantidad: 3,
  };

  it("es opcional y vacío queda sin fecha", () => {
    const vacio = ingresoSchema.safeParse({ ...ingreso, vencimiento: "" });
    expect(vacio.success && vacio.data.vencimiento).toBeUndefined();
    expect(ingresoSchema.safeParse(ingreso).success).toBe(true);
  });

  it("acepta una fecha y rechaza lo que no lo es", () => {
    const ok = ingresoSchema.safeParse({
      ...ingreso,
      vencimiento: "2026-12-31",
    });
    expect(ok.success && ok.data.vencimiento).toBe("2026-12-31");
    for (const vencimiento of ["31/12/2026", "2026-13-01", "mañana"]) {
      expect(ingresoSchema.safeParse({ ...ingreso, vencimiento }).success).toBe(
        false,
      );
    }
  });
});
