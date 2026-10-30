import { describe, expect, it } from "vitest";
import { calcularTotales, descuentoDeLinea } from "./totales";

describe("calcularTotales", () => {
  it("sin descuentos el total es el bruto", () => {
    expect(
      calcularTotales(
        [
          { precio: 2500, cantidad: 1, descuentoPct: 0 },
          { precio: 1500, cantidad: 2, descuentoPct: 0 },
        ],
        0,
      ),
    ).toEqual({
      bruto: 5500,
      descuentoItems: 0,
      descuentoTotal: 0,
      total: 5500,
    });
  });

  it("coincide con los casos de la validación SQL de la 0012", () => {
    // 2 Coca a $ 2.500 con 10 %: $ 4.500.
    expect(
      calcularTotales([{ precio: 2500, cantidad: 2, descuentoPct: 10 }], 0)
        .total,
    ).toBe(4500);
    // Más 5 % sobre el total: $ 225 de descuento, $ 4.275.
    expect(
      calcularTotales([{ precio: 2500, cantidad: 2, descuentoPct: 10 }], 5),
    ).toEqual({
      bruto: 5000,
      descuentoItems: 500,
      descuentoTotal: 225,
      total: 4275,
    });
  });

  it("redondea a centavos como Postgres, con la mitad hacia arriba", () => {
    // 3 × $ 333,33 al 15 % = 149,9985 → 150,00.
    expect(
      descuentoDeLinea({ precio: 333.33, cantidad: 3, descuentoPct: 15 }),
    ).toBe(150);
    // $ 10,01 al 50 % = 5,005 → 5,01.
    expect(
      descuentoDeLinea({ precio: 10.01, cantidad: 1, descuentoPct: 50 }),
    ).toBe(5.01);
  });

  it("el descuento sobre el total se aplica después de los de cada ítem", () => {
    const t = calcularTotales(
      [
        { precio: 1000, cantidad: 1, descuentoPct: 10 },
        { precio: 2000, cantidad: 1, descuentoPct: 0 },
      ],
      10,
    );
    expect(t).toEqual({
      bruto: 3000,
      descuentoItems: 100,
      descuentoTotal: 290,
      total: 2610,
    });
  });
});

describe("calcularTotales con promociones", () => {
  it("la promo se descuenta antes del manual, como en la base", () => {
    // 2 Coca con 2x1 ($ 2.500 de promo) y 10 % manual sobre los $ 2.500 que quedan: $ 250.
    const t = calcularTotales(
      [{ precio: 2500, cantidad: 2, descuentoPct: 10, promoDescuento: 2500 }],
      0,
    );
    expect(t).toEqual({
      bruto: 5000,
      descuentoItems: 2750,
      descuentoTotal: 0,
      total: 2250,
    });
  });

  it("sin promo el resultado no cambia", () => {
    expect(
      calcularTotales([{ precio: 2500, cantidad: 2, descuentoPct: 10 }], 0)
        .total,
    ).toBe(4500);
  });
});
