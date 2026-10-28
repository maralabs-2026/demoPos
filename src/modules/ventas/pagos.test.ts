import { describe, expect, it } from "vitest";
import { resolverPagos, restantePorAsignar, type MedioPagoRef } from "./pagos";

const medios: MedioPagoRef[] = [
  { id: "efe", tipo: "efectivo" },
  { id: "deb", tipo: "tarjeta" },
  { id: "qr", tipo: "qr" },
];

const linea = (key: string, medioPagoId: string, monto: number | null) => ({
  key,
  medioPagoId,
  monto,
});

describe("resolverPagos · un solo medio", () => {
  it("efectivo con recibido calcula el vuelto en centavos exactos", () => {
    expect(
      resolverPagos(
        6300.1,
        { tipo: "unico", medioPagoId: "efe", recibido: 10000 },
        medios,
      ),
    ).toEqual({
      ok: true,
      pagos: [{ medioPagoId: "efe", monto: 6300.1, recibido: 10000 }],
      vuelto: 3699.9,
    });
  });

  it("efectivo sin recibido o con menos que el total no se cobra", () => {
    expect(
      resolverPagos(
        500,
        { tipo: "unico", medioPagoId: "efe", recibido: null },
        medios,
      ),
    ).toEqual({ ok: false, error: "El monto recibido es menor al total" });
    expect(
      resolverPagos(
        500,
        { tipo: "unico", medioPagoId: "efe", recibido: 499.99 },
        medios,
      ).ok,
    ).toBe(false);
  });

  it("tarjeta o QR cobran el total exacto, sin vuelto", () => {
    expect(
      resolverPagos(
        2500,
        { tipo: "unico", medioPagoId: "deb", recibido: null },
        medios,
      ),
    ).toEqual({
      ok: true,
      pagos: [{ medioPagoId: "deb", monto: 2500 }],
      vuelto: null,
    });
  });
});

describe("resolverPagos · combinado", () => {
  it("acepta dos medios que suman exacto el total", () => {
    const result = resolverPagos(
      6400,
      {
        tipo: "combinado",
        pagos: [linea("a", "efe", 4000), linea("b", "deb", 2400)],
      },
      medios,
    );
    expect(result).toEqual({
      ok: true,
      pagos: [
        { medioPagoId: "efe", monto: 4000 },
        { medioPagoId: "deb", monto: 2400 },
      ],
      vuelto: null,
    });
  });

  it("dice cuánto falta o cuánto sobra", () => {
    expect(
      resolverPagos(
        6400,
        {
          tipo: "combinado",
          pagos: [linea("a", "efe", 4000), linea("b", "deb", 2000)],
        },
        medios,
      ),
    ).toEqual({ ok: false, error: "Faltan $ 400,00 para cubrir el total" });
    expect(
      resolverPagos(
        6400,
        {
          tipo: "combinado",
          pagos: [linea("a", "efe", 4000), linea("b", "deb", 2500)],
        },
        medios,
      ),
    ).toEqual({ ok: false, error: "Los pagos superan el total por $ 100,00" });
  });

  it("no suma mal con decimales", () => {
    expect(
      resolverPagos(
        0.3,
        {
          tipo: "combinado",
          pagos: [linea("a", "efe", 0.1), linea("b", "deb", 0.2)],
        },
        medios,
      ).ok,
    ).toBe(true);
  });

  it("pide montos completos, medios distintos y al menos dos líneas", () => {
    expect(
      resolverPagos(
        100,
        {
          tipo: "combinado",
          pagos: [linea("a", "efe", 100), linea("b", "deb", null)],
        },
        medios,
      ),
    ).toEqual({ ok: false, error: "Completá el monto de cada medio de pago" });
    expect(
      resolverPagos(
        100,
        {
          tipo: "combinado",
          pagos: [linea("a", "efe", 50), linea("b", "efe", 50)],
        },
        medios,
      ),
    ).toEqual({ ok: false, error: "Usá cada medio de pago una sola vez" });
    expect(
      resolverPagos(
        100,
        { tipo: "combinado", pagos: [linea("a", "efe", 100)] },
        medios,
      ),
    ).toEqual({
      ok: false,
      error: "Un pago combinado necesita al menos dos medios",
    });
  });
});

describe("restantePorAsignar", () => {
  it("resta lo asignado y toma las líneas vacías como cero", () => {
    expect(
      restantePorAsignar(6400, [
        linea("a", "efe", 4000),
        linea("b", "deb", null),
      ]),
    ).toBe(2400);
  });
});
