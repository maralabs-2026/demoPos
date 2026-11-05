import { describe, expect, it } from "vitest";
import { fechaValida, filtrosDesdeParams } from "./schemas";

const HOY = "2026-11-05";
const USUARIO = "7d3f9a52-1c64-4b8e-9f21-3a5c7e9d1b20";

describe("fechaValida", () => {
  it("acepta fechas reales y rechaza el resto", () => {
    expect(fechaValida("2026-02-28")).toBe("2026-02-28");
    expect(fechaValida("2026-02-31")).toBeNull();
    expect(fechaValida("05/11/2026")).toBeNull();
    expect(fechaValida(undefined)).toBeNull();
  });
});

describe("filtrosDesdeParams", () => {
  it("sin filtros muestra hoy, por día y de todos", () => {
    expect(filtrosDesdeParams({}, HOY)).toEqual({
      desde: HOY,
      hasta: HOY,
      agrupar: "dia",
      usuarioId: null,
    });
  });

  it("usa los filtros válidos", () => {
    expect(
      filtrosDesdeParams(
        {
          desde: "2026-10-01",
          hasta: "2026-10-31",
          agrupar: "semana",
          cajero: USUARIO,
        },
        HOY,
      ),
    ).toEqual({
      desde: "2026-10-01",
      hasta: "2026-10-31",
      agrupar: "semana",
      usuarioId: USUARIO,
    });
  });

  it("corrige fechas invertidas e ignora valores que no sirven", () => {
    const filtros = filtrosDesdeParams(
      {
        desde: "2026-10-31",
        hasta: "2026-10-01",
        agrupar: "anio",
        cajero: "' or 1=1",
      },
      HOY,
    );
    expect(filtros.desde).toBe("2026-10-01");
    expect(filtros.hasta).toBe("2026-10-31");
    expect(filtros.agrupar).toBe("dia");
    expect(filtros.usuarioId).toBeNull();
  });

  it("acota un período demasiado largo", () => {
    expect(
      filtrosDesdeParams({ desde: "2000-01-01", hasta: "2026-01-01" }, HOY)
        .desde,
    ).toBe("2026-01-01");
  });
});
