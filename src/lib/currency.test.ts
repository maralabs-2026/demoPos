import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatCurrency,
  formatPercent,
  parseMonto,
} from "./currency";

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

describe("formatAmount", () => {
  it("formats without the currency sign", () => {
    expect(formatAmount(1234.5)).toBe("1.234,50");
  });
});

describe("parseMonto", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1234,5", 1234.5],
    ["1234", 1234],
    ["$ 10.000", 10000],
    ["  2.000,00 ", 2000],
    ["0", 0],
    ["15,", 15],
    ["1500.50", 1500.5],
    ["1.500", 1500],
  ])("lee %j como %d", (text, expected) => {
    expect(parseMonto(text)).toBe(expected);
  });

  it("devuelve null si está vacío", () => {
    expect(parseMonto("")).toBeNull();
    expect(parseMonto("   ")).toBeNull();
  });

  it.each(["abc", "-100", "1,234,5", "12,345", ",50", "1.2a", "1,2,3"])(
    "devuelve NaN para %j, nunca 0",
    (text) => {
      expect(parseMonto(text)).toBeNaN();
    },
  );
});

describe("formatCurrency sin decimales", () => {
  it("formatea montos redondos", () => {
    expect(formatCurrency(10000, { decimals: 0 })).toBe("$ 10.000");
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
