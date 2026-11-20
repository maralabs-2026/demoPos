import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { canAccess } from "@/modules/auth/navigation";
import { getControlParaRol } from "./control";
import { clavePeriodo } from "./periodo";

// El index de auth arrastra código de servidor; acá alcanza con las reglas de acceso.
vi.mock("@/modules/auth", () => import("@/modules/auth/navigation"));

const ROLES = ["dueno", "encargado", "cajero"] as const;

describe("getControlParaRol", () => {
  it("al cajero solo le da los pasos del día de su turno", () => {
    const bloques = getControlParaRol("cajero");
    expect(bloques.map((b) => b.id)).toEqual(["abrir", "durante", "cerrar"]);
    expect(bloques.every((b) => b.frecuencia === "dia")).toBe(true);
    const pasos = bloques.flatMap((b) => b.pasos.map((p) => p.id));
    expect(pasos).not.toContain("gastos");
    expect(pasos).not.toContain("mercaderia");
  });

  it("al cajero no le habla de costos, márgenes, ganancias ni reportes", () => {
    expect(JSON.stringify(getControlParaRol("cajero"))).not.toMatch(
      /costo|margen|ganancia|reporte/i,
    );
  });

  it("a dueño y encargado les da día, semana y mes", () => {
    for (const rol of ["dueno", "encargado"] as const) {
      const frecuencias = new Set(
        getControlParaRol(rol).map((b) => b.frecuencia),
      );
      expect(frecuencias).toEqual(new Set(["dia", "semana", "mes"]));
    }
  });

  it("no manda a nadie a una pantalla a la que no entra", () => {
    for (const rol of ROLES) {
      for (const bloque of getControlParaRol(rol)) {
        for (const paso of bloque.pasos) {
          if (paso.ruta) expect(canAccess(rol, paso.ruta)).toBe(true);
        }
      }
    }
  });

  it("no repite ids dentro de un bloque", () => {
    for (const bloque of getControlParaRol("dueno")) {
      const ids = bloque.pasos.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("cada texto citado entre « » existe en la interfaz", () => {
    const interfaz = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !/[\\/]ayuda[\\/]/.test(f))
      .map((f) => readFileSync(join("src", f), "utf8"))
      .join(" ")
      .replace(/\s+/g, " ");

    const citas = JSON.stringify(getControlParaRol("dueno")).matchAll(
      /«([^»]+)»/g,
    );
    const faltantes = [...citas]
      .map((cita) => cita[1])
      .filter((texto) => !interfaz.includes(texto));
    expect(faltantes).toEqual([]);
  });
});

describe("clavePeriodo", () => {
  it("el día es la fecha", () => {
    expect(clavePeriodo("dia", "2026-11-20")).toBe("2026-11-20");
  });

  it("la semana empieza el lunes", () => {
    expect(clavePeriodo("semana", "2026-11-16")).toBe("2026-11-16"); // lunes
    expect(clavePeriodo("semana", "2026-11-20")).toBe("2026-11-16"); // viernes
    expect(clavePeriodo("semana", "2026-11-22")).toBe("2026-11-16"); // domingo
    expect(clavePeriodo("semana", "2026-11-23")).toBe("2026-11-23");
  });

  it("la semana cruza el cambio de mes", () => {
    expect(clavePeriodo("semana", "2026-12-02")).toBe("2026-11-30");
  });

  it("el mes es año y mes", () => {
    expect(clavePeriodo("mes", "2026-11-20")).toBe("2026-11");
  });
});
