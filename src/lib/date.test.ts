import { describe, expect, it } from "vitest";
import { formatDateTime } from "./date";

describe("formatDateTime", () => {
  it("muestra la hora de Córdoba (UTC-3)", () => {
    expect(formatDateTime("2026-10-24T18:30:00Z")).toBe("24/10/2026, 15:30");
  });

  it("cambia de día cuando corresponde", () => {
    expect(formatDateTime("2026-10-25T01:05:00Z")).toBe("24/10/2026, 22:05");
  });
});
