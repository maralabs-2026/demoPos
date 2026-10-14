import { describe, expect, it } from "vitest";
import { formatAmount, formatCurrency, parseCurrency } from "./currency";

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

describe("parseCurrency", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1234,5", 1234.5],
    ["1234", 1234],
    ["$ 10.000", 10000],
    ["  2.000,00 ", 2000],
    ["0", 0],
    ["15,", 15],
  ])("parses %j as %d", (text, expected) => {
    expect(parseCurrency(text)).toBe(expected);
  });

  it.each(["", "   ", "abc", "-100", "1,234,5", "12,345", ",50", "1.2a"])(
    "rejects %j",
    (text) => {
      expect(parseCurrency(text)).toBeNull();
    },
  );
});
