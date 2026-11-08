import { describe, expect, it } from "vitest";
import {
  costoFinal,
  margenSobrePrecio,
  subtotalLinea,
  totalCompra,
} from "./compras";

describe("cuentas de la compra", () => {
  it("aplica la bonificación al costo de lista", () => {
    expect(costoFinal(800, 10)).toBe(720);
    expect(costoFinal(800, 0)).toBe(800);
    expect(costoFinal(99.99, 12.5)).toBe(87.49);
    expect(costoFinal(100, 100)).toBe(0);
  });

  it("calcula subtotal y total en centavos", () => {
    const a = { cantidad: 10, costoLista: 800, bonificacionPct: 10 };
    const b = { cantidad: 3, costoLista: 0.1, bonificacionPct: 0 };
    expect(subtotalLinea(a)).toBe(7200);
    expect(subtotalLinea(b)).toBe(0.3);
    expect(totalCompra([a, b])).toBe(7200.3);
    expect(totalCompra([])).toBe(0);
  });

  it("calcula el margen sobre el precio", () => {
    expect(margenSobrePrecio(720, 1000)).toBeCloseTo(28);
  });
});
