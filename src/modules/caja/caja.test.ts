import { describe, expect, it } from "vitest";
import { estadoDiferencia, totalesCierre } from "./cierre";
import {
  cerrarCajaSchema,
  MOTIVO_MOVIMIENTO_MAX,
  NOTA_CIERRE_MAX,
  registrarMovimientoSchema,
} from "./schemas";

const CAJA = "7d3f9a52-1c64-4b8e-9f21-3a5c7e9d1b20";
const MEDIO = "2b8e4c61-9d37-4f15-a8c2-6e1f3d5b7a90";

const valido = {
  cajaId: CAJA,
  conteos: [{ medioPagoId: MEDIO, contado: 1234.56 }],
  nota: "",
};

describe("cerrarCajaSchema", () => {
  it("acepta un conteo válido, incluso en cero", () => {
    expect(cerrarCajaSchema.safeParse(valido).success).toBe(true);
    expect(
      cerrarCajaSchema.safeParse({
        ...valido,
        conteos: [{ medioPagoId: MEDIO, contado: 0 }],
      }).success,
    ).toBe(true);
  });

  it.each([
    ["negativo", -1],
    ["con más de dos decimales", 10.123],
    ["demasiado alto", 10_000_000_000],
    ["infinito", Number.POSITIVE_INFINITY],
  ])("rechaza un monto %s", (_, contado) => {
    expect(
      cerrarCajaSchema.safeParse({
        ...valido,
        conteos: [{ medioPagoId: MEDIO, contado }],
      }).success,
    ).toBe(false);
  });

  it("rechaza un cierre sin conteo o con una caja inválida", () => {
    expect(cerrarCajaSchema.safeParse({ ...valido, conteos: [] }).success).toBe(
      false,
    );
    expect(cerrarCajaSchema.safeParse({ ...valido, cajaId: "x" }).success).toBe(
      false,
    );
  });

  it("recorta la nota y limita su largo", () => {
    expect(
      cerrarCajaSchema.parse({ ...valido, nota: "  Faltó cambio  " }).nota,
    ).toBe("Faltó cambio");
    expect(
      cerrarCajaSchema.safeParse({
        ...valido,
        nota: "x".repeat(NOTA_CIERRE_MAX + 1),
      }).success,
    ).toBe(false);
  });
});

describe("registrarMovimientoSchema", () => {
  const movimiento = {
    cajaId: CAJA,
    tipo: "retiro",
    monto: 1500.5,
    motivo: "  Pago al proveedor  ",
  };

  it("acepta retiros e ingresos y recorta el motivo", () => {
    expect(registrarMovimientoSchema.parse(movimiento).motivo).toBe(
      "Pago al proveedor",
    );
    expect(
      registrarMovimientoSchema.safeParse({ ...movimiento, tipo: "ingreso" })
        .success,
    ).toBe(true);
  });

  it.each([
    ["cero", 0],
    ["negativo", -1],
    ["con más de dos decimales", 10.123],
    ["demasiado alto", 10_000_000_000],
    ["infinito", Number.POSITIVE_INFINITY],
  ])("rechaza un monto %s", (_, monto) => {
    expect(
      registrarMovimientoSchema.safeParse({ ...movimiento, monto }).success,
    ).toBe(false);
  });

  it("rechaza un tipo desconocido y un motivo vacío o demasiado largo", () => {
    for (const cambio of [
      { tipo: "gasto" },
      { motivo: "   " },
      { motivo: "x".repeat(MOTIVO_MOVIMIENTO_MAX + 1) },
    ]) {
      expect(
        registrarMovimientoSchema.safeParse({ ...movimiento, ...cambio })
          .success,
      ).toBe(false);
    }
  });
});

describe("totalesCierre", () => {
  it("suma sin errores de punto flotante", () => {
    const linea = { medioPagoId: MEDIO, nombre: "Efectivo" };
    expect(
      totalesCierre([
        { ...linea, esperado: 0.1, contado: 0.2, diferencia: 0.1 },
        { ...linea, esperado: 0.2, contado: 0.1, diferencia: -0.1 },
      ]),
    ).toEqual({ esperado: 0.3, contado: 0.3, diferencia: 0 });
  });
});

describe("estadoDiferencia", () => {
  it("distingue cuadra, sobra y falta", () => {
    expect(estadoDiferencia(0)).toBe("cuadra");
    expect(estadoDiferencia(0.01)).toBe("sobra");
    expect(estadoDiferencia(-0.01)).toBe("falta");
  });
});
