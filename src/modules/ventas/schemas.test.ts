import { describe, expect, it } from "vitest";
import { registrarVentaSchema } from "./schemas";

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
});
