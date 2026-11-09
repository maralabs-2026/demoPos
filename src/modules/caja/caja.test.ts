import { describe, expect, it } from "vitest";
import { estadoDiferencia, totalesCierre } from "./cierre";
import { estaVencido, hrefDeCaja } from "./gastos";
import {
  cerrarCajaSchema,
  CONTEOS_CIERRE_MAX,
  DESCRIPCION_GASTO_MAX,
  generarCodigoAjusteSchema,
  MOTIVO_MOVIMIENTO_MAX,
  NOTA_CIERRE_MAX,
  registrarAjusteSchema,
  registrarGastoSchema,
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

  it("acepta hasta el tope de conteos y rechaza uno más", () => {
    const conteos = (largo: number) =>
      Array.from({ length: largo }, () => valido.conteos[0]);
    expect(
      cerrarCajaSchema.safeParse({
        ...valido,
        conteos: conteos(CONTEOS_CIERRE_MAX),
      }).success,
    ).toBe(true);
    expect(
      cerrarCajaSchema.safeParse({
        ...valido,
        conteos: conteos(CONTEOS_CIERRE_MAX + 1),
      }).error?.issues[0]?.message,
    ).toBe("El cierre puede tener hasta 50 medios de pago");
  });

  it("corta con un solo error si hay demasiados conteos, sin validar cada uno", () => {
    expect(
      cerrarCajaSchema
        .safeParse({
          ...valido,
          conteos: Array.from({ length: CONTEOS_CIERRE_MAX + 1 }, () => null),
        })
        .error?.issues.map((i) => i.message),
    ).toEqual(["El cierre puede tener hasta 50 medios de pago"]);
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

describe("registrarAjusteSchema", () => {
  const ajuste = {
    cajaId: CAJA,
    tipo: "retiro",
    monto: 500,
    motivo: "Faltante de cambio",
  };

  it("acepta el ajuste del dueño sin código y el de otro con 6 números", () => {
    expect(
      registrarAjusteSchema.safeParse({ ...ajuste, codigo: null }).success,
    ).toBe(true);
    expect(
      registrarAjusteSchema.parse({ ...ajuste, codigo: " 048213 " }).codigo,
    ).toBe("048213");
  });

  it.each([
    ["vacío", ""],
    ["corto", "12345"],
    ["largo", "1234567"],
    ["con letras", "12a456"],
  ])("rechaza un código %s", (_, codigo) => {
    expect(registrarAjusteSchema.safeParse({ ...ajuste, codigo }).success).toBe(
      false,
    );
  });

  it("valida el monto y el motivo igual que un movimiento", () => {
    expect(
      registrarAjusteSchema.safeParse({ ...ajuste, monto: 0, codigo: null })
        .success,
    ).toBe(false);
    expect(
      registrarAjusteSchema.safeParse({ ...ajuste, motivo: " ", codigo: null })
        .success,
    ).toBe(false);
  });
});

describe("generarCodigoAjusteSchema", () => {
  it("acepta un monto máximo positivo con hasta dos decimales", () => {
    expect(
      generarCodigoAjusteSchema.safeParse({ cajaId: CAJA, montoMax: 1500.5 })
        .success,
    ).toBe(true);
  });

  it.each([
    ["faltante", undefined],
    ["cero", 0],
    ["negativo", -10],
    ["con más de dos decimales", 1.234],
    ["demasiado alto", 10_000_000_000],
  ])("rechaza un monto máximo %s", (_, montoMax) => {
    expect(
      generarCodigoAjusteSchema.safeParse({ cajaId: CAJA, montoMax }).success,
    ).toBe(false);
  });

  it("rechaza una caja que no es un uuid", () => {
    expect(
      generarCodigoAjusteSchema.safeParse({ cajaId: "caja-1", montoMax: 100 })
        .success,
    ).toBe(false);
  });
});

describe("registrarGastoSchema", () => {
  const gasto = {
    descripcion: "  Alquiler  ",
    tipo: "fijo",
    monto: 80000,
    vencimiento: "2026-11-10",
    pagado: false,
    cajaId: null,
  };

  it("acepta un gasto por pagar y recorta la descripción", () => {
    expect(registrarGastoSchema.parse(gasto).descripcion).toBe("Alquiler");
  });

  it("acepta uno pagado con la caja o por fuera, sin vencimiento", () => {
    const pagado = { ...gasto, pagado: true, vencimiento: null };
    expect(registrarGastoSchema.safeParse(pagado).success).toBe(true);
    expect(
      registrarGastoSchema.safeParse({ ...pagado, cajaId: CAJA }).success,
    ).toBe(true);
  });

  it("rechaza que un gasto por pagar salga de una caja", () => {
    expect(
      registrarGastoSchema.safeParse({ ...gasto, cajaId: CAJA }).success,
    ).toBe(false);
  });

  it.each([
    ["monto cero", { monto: 0 }],
    ["monto con tres decimales", { monto: 1.234 }],
    ["tipo desconocido", { tipo: "otro" }],
    ["descripción vacía", { descripcion: "   " }],
    [
      "descripción larga",
      { descripcion: "x".repeat(DESCRIPCION_GASTO_MAX + 1) },
    ],
    ["fecha inválida", { vencimiento: "10/11/2026" }],
    ["caja inválida", { pagado: true, cajaId: "x" }],
  ])("rechaza %s", (_, cambio) => {
    expect(
      registrarGastoSchema.safeParse({ ...gasto, ...cambio }).success,
    ).toBe(false);
  });
});

describe("estaVencido", () => {
  it("vence después del día indicado, no ese mismo día", () => {
    expect(estaVencido("2026-11-04", "2026-11-05")).toBe(true);
    expect(estaVencido("2026-11-05", "2026-11-05")).toBe(false);
    expect(estaVencido("2026-11-06", "2026-11-05")).toBe(false);
    expect(estaVencido(null, "2026-11-05")).toBe(false);
  });
});

describe("hrefDeCaja", () => {
  const YO = "yo";

  it("lleva a la caja propia abierta, a la de otro o al cierre", () => {
    const caja = { id: CAJA, usuarioId: YO };
    expect(hrefDeCaja({ ...caja, estado: "abierta" }, YO)).toBe("/caja");
    expect(hrefDeCaja({ ...caja, estado: "abierta" }, "otro")).toBe(
      `/caja/cerrar/${CAJA}`,
    );
    expect(hrefDeCaja({ ...caja, estado: "cerrada" }, YO)).toBe(
      `/caja/historial/${CAJA}`,
    );
    expect(hrefDeCaja({ ...caja, estado: "cerrada" }, "otro")).toBe(
      `/caja/historial/${CAJA}`,
    );
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
