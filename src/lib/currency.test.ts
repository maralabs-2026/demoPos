import { describe, expect, it } from "vitest";
import { formatCurrency, formatPercent, parseMonto } from "./currency";

describe("formatCurrency", () => {
  it("formats with dot as thousands separator and comma as decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$ 1.234,50");
  });

  it("formats small amounts", () => {
    expect(formatCurrency(900)).toBe("$ 900,00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$ 0,00");
  });
});

describe("parseMonto", () => {
  it("lee coma decimal y punto de miles", () => {
    expect(parseMonto("1,5")).toBe(1.5);
    expect(parseMonto("1.234,50")).toBe(1234.5);
    expect(parseMonto("$ 1.234")).toBe(1234);
  });

  it("lee punto decimal cuando no hay coma", () => {
    expect(parseMonto("1234.5")).toBe(1234.5);
    expect(parseMonto("800")).toBe(800);
  });

  it("devuelve null si está vacío", () => {
    expect(parseMonto("")).toBeNull();
    expect(parseMonto("   ")).toBeNull();
  });

  it("devuelve NaN si no se entiende, nunca 0", () => {
    expect(parseMonto("abc")).toBeNaN();
    expect(parseMonto("1,2,3")).toBeNaN();
    expect(parseMonto("-5")).toBeNaN();
  });
});

describe("formatPercent", () => {
  it("formatea con coma decimal y un decimal como máximo", () => {
    expect(formatPercent(33.333)).toBe("33,3 %");
    expect(formatPercent(-25)).toBe("-25 %");
  });

  it("muestra una raya sin valor", () => {
    expect(formatPercent(null)).toBe("—");
  });
});
