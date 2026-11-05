import { describe, expect, it } from "vitest";
import { gananciaNeta, sinCostosCargados } from "./ganancia";

const BASE = { total: 1000, ganancia: 300, sinCosto: 0, gastosPagados: 100 };

describe("gananciaNeta", () => {
  it("resta los gastos pagados sin errores de punto flotante", () => {
    expect(gananciaNeta(BASE)).toBe(200);
    expect(gananciaNeta({ ...BASE, ganancia: 0.3, gastosPagados: 0.1 })).toBe(
      0.2,
    );
  });

  it("puede dar negativa si los gastos superan la ganancia", () => {
    expect(gananciaNeta({ ...BASE, gastosPagados: 500 })).toBe(-200);
  });

  it("es desconocida si ningún ítem tenía costo", () => {
    const resumen = { ...BASE, ganancia: 0, sinCosto: 1000 };
    expect(sinCostosCargados(resumen)).toBe(true);
    expect(gananciaNeta(resumen)).toBeNull();
  });

  it("con costos parciales se calcula sobre lo conocido", () => {
    const resumen = { ...BASE, sinCosto: 400 };
    expect(sinCostosCargados(resumen)).toBe(false);
    expect(gananciaNeta(resumen)).toBe(200);
  });

  it("sin ventas no es desconocida: solo descuenta los gastos", () => {
    expect(
      gananciaNeta({ total: 0, ganancia: 0, sinCosto: 0, gastosPagados: 50 }),
    ).toBe(-50);
  });
});
