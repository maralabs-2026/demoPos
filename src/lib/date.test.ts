import { describe, expect, it } from "vitest";
import { finDelDia, formatDateTime, inicioDelDia, todayISO } from "./date";

describe("formatDateTime", () => {
  it("muestra la hora de Córdoba (UTC-3)", () => {
    expect(formatDateTime("2026-10-24T18:30:00Z")).toBe("24/10/2026, 15:30");
  });

  it("cambia de día cuando corresponde", () => {
    expect(formatDateTime("2026-10-25T01:05:00Z")).toBe("24/10/2026, 22:05");
  });
});

describe("día comercial con hora de corte", () => {
  it("los límites del día se corren a la hora de corte", () => {
    expect(inicioDelDia("2026-02-10", 6)).toBe("2026-02-10T06:00:00-03:00");
    expect(finDelDia("2026-02-10", 6)).toBe("2026-02-11T06:00:00-03:00");
    expect(inicioDelDia("2026-02-10")).toBe("2026-02-10T00:00:00-03:00");
    expect(finDelDia("2026-12-31", 12)).toBe("2027-01-01T12:00:00-03:00");
  });

  it("antes de la hora de corte, hoy sigue siendo el día anterior", () => {
    // 10/02 a las 2:00 en Argentina = 05:00 UTC.
    const madrugada = new Date("2026-02-10T05:00:00Z");
    expect(todayISO(madrugada)).toBe("2026-02-10");
    expect(todayISO(madrugada, 6)).toBe("2026-02-09");
    // 10/02 a las 6:00 en Argentina: ya es el martes.
    expect(todayISO(new Date("2026-02-10T09:00:00Z"), 6)).toBe("2026-02-10");
  });
});
