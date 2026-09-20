import { describe, expect, it } from "vitest";
import { formatCurrency } from "./currency";

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
