import { describe, expect, it } from "vitest";
import {
  desgloseCierre,
  estadoDiferencia,
  resumenDelDia,
  totalesCierre,
  type PagoDeVenta,
  type VentaDeCaja,
} from "./cierre";
import { estaVencido, hrefDeCaja } from "./gastos";
import {
  estadoTransferencia,
  resumenTransferencias,
  type Transferencia,
} from "./transferencias";
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
  verificarTransferenciaSchema,
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

describe("desgloseCierre", () => {
  const EFECTIVO = "11111111-1111-4111-8111-111111111111";
  const DEBITO = "22222222-2222-4222-8222-222222222222";
  const CERRADA = "2026-11-18T20:00:00.000Z";

  const venta = (
    id: string,
    createdAt: string,
    pagos: PagoDeVenta[],
    extra: Partial<VentaDeCaja> = {},
  ): VentaDeCaja => ({
    id,
    createdAt,
    cajero: "Ana",
    anulada: false,
    anuladaAt: null,
    pagos,
    ...extra,
  });

  const lineas = (efectivo: number, debito: number) => [
    {
      medioPagoId: EFECTIVO,
      nombre: "Efectivo",
      esperado: efectivo,
      contado: 0,
      diferencia: 0,
    },
    {
      medioPagoId: DEBITO,
      nombre: "Débito",
      esperado: debito,
      contado: 0,
      diferencia: 0,
    },
  ];

  it("arma el esperado con ventas, fondo, ingresos y retiros", () => {
    const ventas = [
      venta("b", "2026-11-18T15:00:00.000Z", [
        { medioPagoId: EFECTIVO, monto: 2500 },
      ]),
      venta("a", "2026-11-18T14:00:00.000Z", [
        { medioPagoId: EFECTIVO, monto: 2500 },
      ]),
      venta("c", "2026-11-18T16:00:00.000Z", [
        { medioPagoId: DEBITO, monto: 2500 },
      ]),
    ];
    const d = desgloseCierre(lineas(5200, 2500), ventas, {
      cerradaAt: CERRADA,
      fondo: 1000,
      ingresos: 200,
      retiros: 1000,
    });
    const efectivo = d.get(EFECTIVO)!;
    expect(efectivo.ventas.map((v) => v.id)).toEqual(["a", "b"]);
    expect(efectivo.totalVentas).toBe(5000);
    expect(efectivo.caja).toEqual({
      fondo: 1000,
      ingresos: 200,
      retiros: 1000,
    });
    expect(efectivo.sinDetalle).toBe(0);
    const debito = d.get(DEBITO)!;
    expect(debito.totalVentas).toBe(2500);
    expect(debito.caja).toBeNull();
    expect(debito.sinDetalle).toBe(0);
  });

  it("reparte un pago combinado entre sus medios", () => {
    const ventas = [
      venta("a", "2026-11-18T14:00:00.000Z", [
        { medioPagoId: EFECTIVO, monto: 1000.1 },
        { medioPagoId: DEBITO, monto: 1500.2 },
      ]),
    ];
    const d = desgloseCierre(lineas(1000.1, 1500.2), ventas, {
      cerradaAt: CERRADA,
      fondo: 0,
      ingresos: 0,
      retiros: 0,
    });
    expect(d.get(EFECTIVO)!.ventas[0]).toMatchObject({
      monto: 1000.1,
      combinado: true,
    });
    expect(d.get(DEBITO)!.ventas[0]).toMatchObject({
      monto: 1500.2,
      combinado: true,
    });
    expect(d.get(EFECTIVO)!.caja).toBeNull();
    expect(d.get(DEBITO)!.sinDetalle).toBe(0);
  });

  it("una anulada antes del cierre no suma; una anulada después, sí", () => {
    const ventas = [
      venta(
        "antes",
        "2026-11-18T14:00:00.000Z",
        [{ medioPagoId: DEBITO, monto: 700 }],
        {
          anulada: true,
          anuladaAt: "2026-11-18T19:00:00.000Z",
        },
      ),
      venta(
        "despues",
        "2026-11-18T15:00:00.000Z",
        [{ medioPagoId: DEBITO, monto: 300 }],
        {
          anulada: true,
          anuladaAt: "2026-11-19T10:00:00.000Z",
        },
      ),
    ];
    const d = desgloseCierre(lineas(0, 300), ventas, {
      cerradaAt: CERRADA,
      fondo: 0,
      ingresos: 0,
      retiros: 0,
    });
    const debito = d.get(DEBITO)!;
    expect(debito.ventas.map((v) => v.anulada)).toEqual(["antes", "despues"]);
    expect(debito.totalVentas).toBe(300);
    expect(debito.sinDetalle).toBe(0);
  });

  it("lo que no se explica queda a la vista", () => {
    const d = desgloseCierre(lineas(1000, 50), [], {
      cerradaAt: CERRADA,
      fondo: 1000,
      ingresos: 0,
      retiros: 0,
    });
    expect(d.get(EFECTIVO)!.caja).toEqual({
      fondo: 1000,
      ingresos: 0,
      retiros: 0,
    });
    expect(d.get(DEBITO)!.sinDetalle).toBe(50);
  });
});

describe("resumenDelDia", () => {
  const EFECTIVO = "11111111-1111-4111-8111-111111111111";
  const DEBITO = "22222222-2222-4222-8222-222222222222";
  const linea = (
    medioPagoId: string,
    nombre: string,
    esperado: number,
    contado: number,
  ) => ({
    medioPagoId,
    nombre,
    esperado,
    contado,
    diferencia: Math.round((contado - esperado) * 100) / 100,
  });

  it("suma por medio las cajas del día y cuenta las que tuvieron diferencia", () => {
    const r = resumenDelDia([
      {
        lineas: [
          linea(EFECTIVO, "Efectivo", 5200, 5100),
          linea(DEBITO, "Débito", 2500, 2500),
        ],
      },
      {
        lineas: [
          linea(EFECTIVO, "Efectivo", 1000.1, 1000.1),
          linea(DEBITO, "Débito", 300.2, 300.2),
        ],
      },
      { lineas: [] },
    ]);
    expect(r.medios).toEqual([
      {
        medioPagoId: DEBITO,
        nombre: "Débito",
        esperado: 2800.2,
        contado: 2800.2,
        diferencia: 0,
        cajasConDiferencia: 0,
      },
      {
        medioPagoId: EFECTIVO,
        nombre: "Efectivo",
        esperado: 6200.1,
        contado: 6100.1,
        diferencia: -100,
        cajasConDiferencia: 1,
      },
    ]);
    expect(r.totales).toEqual({
      esperado: 9000.3,
      contado: 8900.3,
      diferencia: -100,
    });
    expect(r.cajasConDiferencia).toBe(1);
  });

  it("una caja con faltante y sobrante que se compensan igual tiene diferencia", () => {
    const r = resumenDelDia([
      {
        lineas: [
          linea(EFECTIVO, "Efectivo", 1000, 900),
          linea(DEBITO, "Débito", 500, 600),
        ],
      },
    ]);
    expect(r.totales.diferencia).toBe(0);
    expect(r.cajasConDiferencia).toBe(1);
  });

  it("sin cierres, todo en cero", () => {
    const r = resumenDelDia([]);
    expect(r.medios).toEqual([]);
    expect(r.totales).toEqual({ esperado: 0, contado: 0, diferencia: 0 });
    expect(r.cajasConDiferencia).toBe(0);
  });
});

describe("transferencias", () => {
  const t = (
    id: string,
    monto: number,
    verificaciones: Transferencia["verificaciones"] = [],
  ): Transferencia => ({
    ventaPagoId: id,
    ventaId: id,
    createdAt: "2026-11-19T14:00:00.000Z",
    monto,
    medio: "Transferencia",
    cajero: "Ana",
    verificaciones,
  });

  it("el estado es la última marca, sin importar el orden en que llegan", () => {
    expect(estadoTransferencia(t("a", 100))).toBe("pendiente");
    expect(
      estadoTransferencia(
        t("b", 100, [
          {
            estado: "no_llego",
            createdAt: "2026-11-19T15:00:00.000Z",
            autor: "Encargado",
          },
          {
            estado: "llego",
            createdAt: "2026-11-19T18:00:00.000Z",
            autor: "Dueño",
          },
        ]),
      ),
    ).toBe("llego");
  });

  it("suma cantidad y monto por estado, en centavos", () => {
    const r = resumenTransferencias([
      t("a", 100.1),
      t("b", 200.2),
      t("c", 50, [
        {
          estado: "llego",
          createdAt: "2026-11-19T15:00:00.000Z",
          autor: "Dueño",
        },
      ]),
      t("d", 30, [
        {
          estado: "no_llego",
          createdAt: "2026-11-19T15:00:00.000Z",
          autor: "Dueño",
        },
      ]),
    ]);
    expect(r).toEqual({
      llego: { cantidad: 1, monto: 50 },
      no_llego: { cantidad: 1, monto: 30 },
      pendiente: { cantidad: 2, monto: 300.3 },
    });
  });
});

describe("verificarTransferenciaSchema", () => {
  it("acepta un pago con llegó o no llegó", () => {
    for (const estado of ["llego", "no_llego"]) {
      expect(
        verificarTransferenciaSchema.safeParse({ ventaPagoId: CAJA, estado })
          .success,
      ).toBe(true);
    }
  });

  it("rechaza un estado inventado o un pago que no es un id", () => {
    expect(
      verificarTransferenciaSchema.safeParse({
        ventaPagoId: CAJA,
        estado: "quizas",
      }).success,
    ).toBe(false);
    expect(
      verificarTransferenciaSchema.safeParse({
        ventaPagoId: "123",
        estado: "llego",
      }).success,
    ).toBe(false);
  });
});
