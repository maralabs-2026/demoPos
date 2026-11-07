import { describe, expect, it } from "vitest";
import { ventaSinConexionSchema } from "./schemas";
import {
  armarVentaSinConexion,
  comprobanteSinConexion,
  type LineaCobrada,
} from "./sin-conexion";

const VENTA = "6d1c4f5b-8e0a-4b2c-9d9e-4f5a6b7c8d9e";
const CAJA = "3f8a1c2e-5b7d-4e9f-8a6b-1c2d3e4f5a6b";
const COCA = "4b9a2d3f-6c8e-4f0a-9b7c-2d3e4f5a6b7c";
const TAZA = "7e2d5a6c-9f1b-4c3d-8e0f-5a6b7c8d9e0f";
const EFECTIVO = "5c0b3e4a-7d9f-4a1b-8c8d-3e4f5a6b7c8d";
const DEBITO = "8f3e6b7d-0a2c-4d4e-9f1a-6b7c8d9e0f1a";
const medios = [
  { id: EFECTIVO, nombre: "Efectivo", tipo: "efectivo" as const },
  { id: DEBITO, nombre: "Débito", tipo: "tarjeta" as const },
];

const lineas: LineaCobrada[] = [
  {
    productoId: COCA,
    nombre: "Coca-Cola 500ml",
    precio: 2500,
    cantidad: 2,
    descuento: 2500,
    promocionDescuento: 2500,
    promocionNombre: "2x1 Coca",
  },
  {
    productoId: TAZA,
    nombre: "Taza",
    precio: 1000.5,
    cantidad: 1,
    descuento: 100.05,
    promocionDescuento: 0,
    promocionNombre: "",
  },
];

describe("armarVentaSinConexion", () => {
  it("arma una venta que el schema acepta, con la hora en ISO", () => {
    const venta = armarVentaSinConexion({
      ventaId: VENTA,
      cajaId: CAJA,
      fecha: new Date("2026-11-07T01:15:00Z"),
      lineas,
      descuentoTotal: 0,
      pagos: [{ medioPagoId: EFECTIVO, monto: 3400.45, recibido: 5000 }],
    });
    expect(ventaSinConexionSchema.safeParse(venta).success).toBe(true);
    expect(venta.fecha).toBe("2026-11-07T01:15:00.000Z");
    expect(venta.items[0]).toMatchObject({
      precioUnitario: 2500,
      descuento: 2500,
      promocionDescuento: 2500,
      promocionNombre: "2x1 Coca",
    });
    // Sin descuento de promo no se manda el nombre.
    expect(venta.items[1].promocionNombre).toBeNull();
  });
});

describe("comprobanteSinConexion", () => {
  const venta = armarVentaSinConexion({
    ventaId: VENTA,
    cajaId: CAJA,
    fecha: new Date("2026-11-07T01:15:00Z"),
    lineas,
    descuentoTotal: 40.45,
    pagos: [
      { medioPagoId: DEBITO, monto: 1000 },
      { medioPagoId: EFECTIVO, monto: 2360, recibido: 2500 },
    ],
  });
  const comprobante = comprobanteSinConexion(venta, lineas, medios);

  it("calcula subtotales y total en centavos", () => {
    expect(comprobante.items.map((i) => i.subtotal)).toEqual([2500, 900.45]);
    expect(comprobante.total).toBe(3360);
    expect(comprobante.descuentoTotal).toBe(40.45);
    expect(comprobante.items[0].promocion).toBe("2x1 Coca");
    expect(comprobante.items[1].promocion).toBeNull();
  });

  it("nombra los medios y calcula el vuelto del efectivo", () => {
    expect(comprobante.medioPagoNombre).toBe("Débito + Efectivo");
    expect(comprobante.vuelto).toBe(140);
    expect(comprobante.fecha).toBe(venta.fecha);
  });

  it("sin efectivo no hay vuelto", () => {
    const soloDebito = {
      ...venta,
      pagos: [{ medioPagoId: DEBITO, monto: 3360 }],
    };
    expect(
      comprobanteSinConexion(soloDebito, lineas, medios).vuelto,
    ).toBeNull();
  });
});
