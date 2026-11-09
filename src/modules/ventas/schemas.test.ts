import { describe, expect, it } from "vitest";
import {
  ITEMS_VENTA_MAX,
  PAGOS_VENTA_MAX,
  registrarVentaSchema,
  ventaSinConexionSchema,
} from "./schemas";

const CAJA = "3f8a1c2e-5b7d-4e9f-8a6b-1c2d3e4f5a6b";
const PRODUCTO = "4b9a2d3f-6c8e-4f0a-9b7c-2d3e4f5a6b7c";
const MEDIO = "5c0b3e4a-7d9f-4a1b-8c8d-3e4f5a6b7c8d";

const venta = {
  cajaId: CAJA,
  items: [{ productoId: PRODUCTO, cantidad: 2 }],
  pagos: [{ medioPagoId: MEDIO, monto: 5000, recibido: 10000 }],
};

describe("registrarVentaSchema", () => {
  it("acepta una venta con caja, ítems y un pago en efectivo", () => {
    expect(registrarVentaSchema.safeParse(venta).success).toBe(true);
  });

  it("acepta pagos combinados y un pago sin recibido", () => {
    const result = registrarVentaSchema.safeParse({
      ...venta,
      pagos: [
        { medioPagoId: MEDIO, monto: 3000, recibido: 3000 },
        { medioPagoId: MEDIO, monto: 2000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("pide abrir la caja si no hay caja", () => {
    const result = registrarVentaSchema.safeParse({ ...venta, cajaId: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Abrí tu caja para cobrar");
  });

  it("rechaza un carrito vacío o sin pagos", () => {
    expect(
      registrarVentaSchema.safeParse({ ...venta, items: [] }).error?.issues[0]
        ?.message,
    ).toBe("El carrito está vacío");
    expect(
      registrarVentaSchema.safeParse({ ...venta, pagos: [] }).error?.issues[0]
        ?.message,
    ).toBe("Elegí un medio de pago");
  });

  it("rechaza cantidades no enteras y montos en cero o negativos", () => {
    expect(
      registrarVentaSchema.safeParse({
        ...venta,
        items: [{ productoId: PRODUCTO, cantidad: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      registrarVentaSchema.safeParse({
        ...venta,
        pagos: [{ medioPagoId: MEDIO, monto: 0 }],
      }).success,
    ).toBe(false);
  });

  it("acepta hasta el tope de ítems y rechaza uno más", () => {
    const items = (largo: number) =>
      Array.from({ length: largo }, () => venta.items[0]);
    expect(
      registrarVentaSchema.safeParse({
        ...venta,
        items: items(ITEMS_VENTA_MAX),
      }).success,
    ).toBe(true);
    expect(
      registrarVentaSchema.safeParse({
        ...venta,
        items: items(ITEMS_VENTA_MAX + 1),
      }).error?.issues[0]?.message,
    ).toBe("La venta puede tener hasta 200 productos distintos");
  });

  it("acepta hasta el tope de pagos y rechaza uno más", () => {
    const pagos = (largo: number) =>
      Array.from({ length: largo }, () => venta.pagos[0]);
    expect(
      registrarVentaSchema.safeParse({
        ...venta,
        pagos: pagos(PAGOS_VENTA_MAX),
      }).success,
    ).toBe(true);
    expect(
      registrarVentaSchema.safeParse({
        ...venta,
        pagos: pagos(PAGOS_VENTA_MAX + 1),
      }).error?.issues[0]?.message,
    ).toBe("La venta puede tener hasta 20 pagos");
  });
});

describe("ventaSinConexionSchema", () => {
  const VENTA = "6d1c4f5b-8e0a-4b2c-9d9e-4f5a6b7c8d9e";
  const OTRO = "7e2d5a6c-9f1b-4c3d-8e0f-5a6b7c8d9e0f";
  const linea = {
    productoId: PRODUCTO,
    cantidad: 2,
    precioUnitario: 1000,
    descuento: 500,
    promocionDescuento: 500,
    promocionNombre: "2x1",
  };
  const sinConexion = {
    ventaId: VENTA,
    cajaId: CAJA,
    fecha: "2026-11-06T22:15:00.000-03:00",
    items: [linea],
    pagos: [{ medioPagoId: MEDIO, monto: 1500, recibido: 2000 }],
    descuento: 0,
  };

  it("acepta lo que se cobró, con promo y hora local", () => {
    expect(ventaSinConexionSchema.safeParse(sinConexion).success).toBe(true);
    expect(
      ventaSinConexionSchema.safeParse({
        ...sinConexion,
        fecha: "2026-11-07T01:15:00Z",
      }).success,
    ).toBe(true);
  });

  it("acepta un producto a precio cero sin promo", () => {
    const gratis = {
      ...linea,
      precioUnitario: 0,
      descuento: 0,
      promocionDescuento: 0,
      promocionNombre: null,
    };
    expect(
      ventaSinConexionSchema.safeParse({
        ...sinConexion,
        items: [gratis, { ...linea, productoId: OTRO }],
      }).success,
    ).toBe(true);
  });

  it("rechaza una venta sin id o con una hora inválida", () => {
    expect(
      ventaSinConexionSchema.safeParse({ ...sinConexion, ventaId: "x" })
        .success,
    ).toBe(false);
    expect(
      ventaSinConexionSchema.safeParse({ ...sinConexion, fecha: "ayer" })
        .success,
    ).toBe(false);
    expect(
      ventaSinConexionSchema.safeParse({
        ...sinConexion,
        fecha: "2026-11-06T22:15:00",
      }).success,
    ).toBe(false);
  });

  it("rechaza descuentos que no cierran", () => {
    const masPromoQueDescuento = {
      ...linea,
      descuento: 100,
      promocionDescuento: 500,
    };
    const masQueLaLinea = { ...linea, descuento: 2500, promocionDescuento: 0 };
    expect(
      ventaSinConexionSchema.safeParse({
        ...sinConexion,
        items: [masPromoQueDescuento],
      }).success,
    ).toBe(false);
    expect(
      ventaSinConexionSchema.safeParse({
        ...sinConexion,
        items: [masQueLaLinea],
      }).success,
    ).toBe(false);
    expect(
      ventaSinConexionSchema.safeParse({ ...sinConexion, descuento: -1 })
        .success,
    ).toBe(false);
  });

  it("rechaza un producto repetido, cantidades inválidas y ventas vacías", () => {
    expect(
      ventaSinConexionSchema.safeParse({
        ...sinConexion,
        items: [linea, linea],
      }).success,
    ).toBe(false);
    expect(
      ventaSinConexionSchema.safeParse({
        ...sinConexion,
        items: [{ ...linea, cantidad: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      ventaSinConexionSchema.safeParse({ ...sinConexion, items: [] }).success,
    ).toBe(false);
    expect(
      ventaSinConexionSchema.safeParse({ ...sinConexion, pagos: [] }).success,
    ).toBe(false);
  });

  it("respeta los topes de ítems y pagos", () => {
    const items = Array.from({ length: ITEMS_VENTA_MAX + 1 }, (_, i) => ({
      ...linea,
      productoId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    }));
    expect(
      ventaSinConexionSchema.safeParse({ ...sinConexion, items }).success,
    ).toBe(false);
    const pagos = Array.from({ length: PAGOS_VENTA_MAX + 1 }, () => ({
      medioPagoId: MEDIO,
      monto: 1,
    }));
    expect(
      ventaSinConexionSchema.safeParse({ ...sinConexion, pagos }).success,
    ).toBe(false);
  });
});

// Si Zod validara cada elemento antes del tope, habría un error por elemento.
describe("topes antes de validar cada elemento", () => {
  const invalidos = (largo: number) =>
    Array.from({ length: largo }, () => null);
  const mensajes = (input: unknown) =>
    registrarVentaSchema.safeParse(input).error?.issues.map((i) => i.message);

  it("corta con un solo error si hay demasiados ítems", () => {
    expect(
      mensajes({ ...venta, items: invalidos(ITEMS_VENTA_MAX + 1) }),
    ).toEqual(["La venta puede tener hasta 200 productos distintos"]);
  });

  it("corta con un solo error si hay demasiados pagos", () => {
    expect(
      mensajes({ ...venta, pagos: invalidos(PAGOS_VENTA_MAX + 1) }),
    ).toEqual(["La venta puede tener hasta 20 pagos"]);
  });

  it("corta sin fallar en una venta sin conexión con demasiados ítems", () => {
    const result = ventaSinConexionSchema.safeParse({
      ventaId: "6d1c4f5b-8e0a-4b2c-9d9e-4f5a6b7c8d9e",
      cajaId: CAJA,
      fecha: "2026-11-06T22:15:00.000-03:00",
      items: invalidos(ITEMS_VENTA_MAX + 1),
      pagos: venta.pagos,
      descuento: 0,
    });
    expect(result.error?.issues).toHaveLength(1);
  });
});

describe("precio al cobrar en registrarVentaSchema", () => {
  it("acepta un precio positivo y lo deja opcional", () => {
    const conPrecio = {
      ...venta,
      items: [{ productoId: PRODUCTO, cantidad: 1, precio: 1500 }],
    };
    expect(registrarVentaSchema.safeParse(conPrecio).success).toBe(true);
    expect(registrarVentaSchema.safeParse(venta).success).toBe(true);
  });

  it("rechaza un precio en cero o negativo", () => {
    for (const precio of [0, -10]) {
      const item = { productoId: PRODUCTO, cantidad: 1, precio };
      expect(
        registrarVentaSchema.safeParse({ ...venta, items: [item] }).success,
      ).toBe(false);
    }
  });
});
