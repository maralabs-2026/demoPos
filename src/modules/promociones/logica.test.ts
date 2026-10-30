import { describe, expect, it } from "vitest";
import {
  ahoraEnCordoba,
  descuentoPromocion,
  mejorPromo,
  promoVigente,
  type Promo,
} from "./logica";

const base: Promo = {
  id: "p1",
  nombre: "Promo",
  tipo: "nxm",
  alcance: "producto",
  productoId: "coca",
  categoriaId: "bebidas",
  lleva: 2,
  paga: 1,
  cantidad: null,
  precio: null,
  porcentaje: null,
  dias: [0, 1, 2, 3, 4, 5, 6],
  desde: "00:00:00",
  hasta: "23:59:59",
  activa: true,
};
const dosXUno = base;
const tresPor6000: Promo = {
  ...base,
  id: "p2",
  nombre: "3 por 6000",
  tipo: "precio_cantidad",
  lleva: null,
  paga: null,
  cantidad: 3,
  precio: 6000,
};
const pct20Bebidas: Promo = {
  ...base,
  id: "p3",
  nombre: "Bebidas 20 %",
  tipo: "porcentaje",
  alcance: "categoria",
  productoId: null,
  categoriaId: "bebidas",
  lleva: null,
  paga: null,
  porcentaje: 20,
};
const coca = { productoId: "coca", categoriaId: "bebidas", precio: 2500 };
const lunes14h = { dia: 1, hora: "14:00:00" };

describe("descuentoPromocion", () => {
  it("2x1: dos unidades cobran una", () => {
    expect(descuentoPromocion(dosXUno, 2500, 2)).toBe(2500);
  });

  it("2x1: tres unidades cobran dos (un solo descuento de una unidad)", () => {
    expect(descuentoPromocion(dosXUno, 2500, 3)).toBe(2500);
  });

  it("2x1: una unidad no tiene descuento", () => {
    expect(descuentoPromocion(dosXUno, 2500, 1)).toBe(0);
  });

  it("precio por cantidad: tres a $ 6.000 con tres unidades", () => {
    expect(descuentoPromocion(tresPor6000, 2500, 3)).toBe(1500);
  });

  it("precio por cantidad: dos unidades no alcanzan el grupo", () => {
    expect(descuentoPromocion(tresPor6000, 2500, 2)).toBe(0);
  });

  it("porcentaje redondea a centavos con la mitad hacia arriba", () => {
    // 3 × $ 10,01 al 20 % = 6,006 → 6,01.
    expect(descuentoPromocion(pct20Bebidas, 10.01, 3)).toBe(6.01);
    // 5 × $ 2.500 al 20 % = $ 2.500.
    expect(descuentoPromocion(pct20Bebidas, 2500, 5)).toBe(2500);
  });
});

describe("mejorPromo", () => {
  it("elige la promo de mayor descuento para la línea", () => {
    // Con dos unidades: 2x1 descuenta $ 2.500 y el 20 % $ 1.000.
    expect(
      mejorPromo([pct20Bebidas, dosXUno], { ...coca, cantidad: 2 }, lunes14h),
    ).toEqual({
      nombre: "Promo",
      descuento: 2500,
    });
  });

  it("una promo de alcance categoría aplica a los productos de esa categoría", () => {
    const otra = { ...coca, productoId: "agua", cantidad: 2 };
    expect(mejorPromo([pct20Bebidas], otra, lunes14h)).toEqual({
      nombre: "Bebidas 20 %",
      descuento: 1000,
    });
  });

  it("devuelve null si ninguna promo aplica a la línea", () => {
    const galleta = {
      productoId: "oreo",
      categoriaId: "galletitas",
      precio: 2900,
      cantidad: 2,
    };
    expect(mejorPromo([dosXUno, pct20Bebidas], galleta, lunes14h)).toBeNull();
  });
});

describe("vigencia", () => {
  it("una promo solo vale los días y horas que tiene", () => {
    const martesTarde = {
      ...dosXUno,
      dias: [2],
      desde: "15:00:00",
      hasta: "19:00:00",
    };
    expect(promoVigente(martesTarde, { dia: 2, hora: "16:30:00" })).toBe(true);
    expect(promoVigente(martesTarde, { dia: 3, hora: "16:30:00" })).toBe(false);
    expect(promoVigente(martesTarde, { dia: 2, hora: "20:00:00" })).toBe(false);
  });

  it("una promo desactivada no aplica", () => {
    expect(promoVigente({ ...dosXUno, activa: false }, lunes14h)).toBe(false);
  });

  it("ahoraEnCordoba devuelve día y hora en Córdoba", () => {
    // 2026-10-27 15:00 UTC es martes 12:00 en Córdoba (UTC-3).
    const ahora = ahoraEnCordoba(new Date("2026-10-27T15:00:00Z"));
    expect(ahora).toEqual({ dia: 2, hora: "12:00:00" });
  });
});
