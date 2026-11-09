import { describe, expect, it } from "vitest";
import {
  contarPorFiltroStock,
  estadoStock,
  parseFiltroStock,
  pasaFiltroStock,
} from "./stock-filtro";

const p = (stockActual: number, stockMinimo: number, controlaStock = true) => ({
  stockActual,
  stockMinimo,
  controlaStock,
});

describe("estadoStock", () => {
  it.each([
    [p(0, 5), "sin_stock"],
    [p(-2, 5), "sin_stock"],
    [p(0, 0), "sin_stock"],
    [p(3, 5), "bajo_minimo"],
    [p(5, 5), "al_dia"],
    [p(0, 5, false), "servicio"],
  ])("clasifica %o como %s", (producto, estado) => {
    expect(estadoStock(producto)).toBe(estado);
  });
});

describe("pasaFiltroStock", () => {
  it("faltantes junta sin stock y bajo el mínimo", () => {
    expect(pasaFiltroStock(p(0, 5), "faltantes")).toBe(true);
    expect(pasaFiltroStock(p(3, 5), "faltantes")).toBe(true);
    expect(pasaFiltroStock(p(5, 5), "faltantes")).toBe(false);
  });

  it("cada estado filtra solo lo suyo", () => {
    expect(pasaFiltroStock(p(0, 5), "bajo_minimo")).toBe(false);
    expect(pasaFiltroStock(p(3, 5), "sin_stock")).toBe(false);
  });

  it("un servicio solo aparece en todos", () => {
    const servicio = p(0, 5, false);
    expect(pasaFiltroStock(servicio, "todos")).toBe(true);
    expect(pasaFiltroStock(servicio, "faltantes")).toBe(false);
  });
});

describe("contarPorFiltroStock", () => {
  it("cuenta cada estado y el total de faltantes", () => {
    expect(
      contarPorFiltroStock([
        p(0, 5),
        p(3, 5),
        p(1, 2),
        p(9, 5),
        p(0, 5, false),
      ]),
    ).toEqual({ faltantes: 3, sin_stock: 1, bajo_minimo: 2 });
  });
});

describe("parseFiltroStock", () => {
  it("acepta los filtros conocidos", () => {
    expect(parseFiltroStock("faltantes")).toBe("faltantes");
    expect(parseFiltroStock("sin_stock")).toBe("sin_stock");
    expect(parseFiltroStock("bajo_minimo")).toBe("bajo_minimo");
  });

  it("cualquier otro valor es todos", () => {
    expect(parseFiltroStock("otra")).toBe("todos");
    expect(parseFiltroStock(null)).toBe("todos");
    expect(parseFiltroStock(undefined)).toBe("todos");
  });
});
