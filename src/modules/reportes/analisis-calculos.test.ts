import { describe, expect, it } from "vitest";
import {
  anchoBarra,
  horasContinuas,
  margenCategoria,
  semanaCompleta,
} from "./analisis-calculos";

describe("margenCategoria", () => {
  it("calcula sobre lo vendido con costo", () => {
    expect(margenCategoria(800, 2000)).toBe(40);
  });

  it("sin ventas con costo no hay margen", () => {
    expect(margenCategoria(0, 0)).toBeNull();
  });
});

describe("horasContinuas", () => {
  it("rellena con cero las horas del medio", () => {
    const horas = horasContinuas([
      { hora: 22, ventas: 2, total: 100 },
      { hora: 20, ventas: 1, total: 50 },
    ]);
    expect(horas.map((h) => h.hora)).toEqual([20, 21, 22]);
    expect(horas[1]).toEqual({ hora: 21, ventas: 0, total: 0 });
  });

  it("sin ventas queda vacío", () => {
    expect(horasContinuas([])).toEqual([]);
  });
});

describe("semanaCompleta", () => {
  it("va de lunes a domingo, con los días sin ventas en cero", () => {
    const semana = semanaCompleta([{ dia: 0, ventas: 3, total: 90 }]);
    expect(semana.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(semana[6].ventas).toBe(3);
    expect(semana[0].ventas).toBe(0);
  });
});

describe("anchoBarra", () => {
  it("escala al máximo, con un mínimo visible", () => {
    expect(anchoBarra(50, 100)).toBe(50);
    expect(anchoBarra(1, 10000)).toBe(2);
  });

  it("cero no dibuja barra", () => {
    expect(anchoBarra(0, 100)).toBe(0);
    expect(anchoBarra(10, 0)).toBe(0);
  });
});
