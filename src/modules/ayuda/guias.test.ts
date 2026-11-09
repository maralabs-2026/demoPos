import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buscarGuias } from "./buscar";
import { getGuiasParaRol } from "./guias";

// El index de auth arrastra código de servidor; acá alcanza con las reglas de acceso.
vi.mock("@/modules/auth", () => import("@/modules/auth/navigation"));

function texto(rol: "dueno" | "encargado" | "cajero"): string {
  return JSON.stringify(getGuiasParaRol(rol));
}

describe("getGuiasParaRol", () => {
  it("al cajero solo le da guías de mostrador y de pantallas a las que entra", () => {
    const guias = getGuiasParaRol("cajero");
    expect(guias.length).toBeGreaterThan(0);
    expect(new Set(guias.map((g) => g.seccion))).toEqual(
      new Set(["mostrador"]),
    );
    expect(guias.map((g) => g.id)).not.toContain("cerrar-caja-otro");
  });

  it("al cajero no le habla de costos, márgenes, ganancias ni reportes", () => {
    expect(texto("cajero")).not.toMatch(/costo|margen|ganancia|reporte/i);
  });

  it("a dueño y encargado les da todas las secciones", () => {
    for (const rol of ["dueno", "encargado"] as const) {
      const secciones = new Set(getGuiasParaRol(rol).map((g) => g.seccion));
      expect(secciones).toEqual(
        new Set(["mostrador", "mercaderia", "negocio", "administracion"]),
      );
    }
  });

  it("la configuración es solo para el dueño", () => {
    const ruta = (rol: "dueno" | "encargado") =>
      getGuiasParaRol(rol).map((g) => g.ruta);
    expect(ruta("dueno")).toContain("/config");
    expect(ruta("encargado")).not.toContain("/config");
  });

  // Si cambia el texto de un botón, este test avisa qué guía quedó vieja.
  it("cada texto citado entre « » existe en la interfaz", () => {
    const interfaz = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !/[\\/]ayuda[\\/]/.test(f))
      .map((f) => readFileSync(join("src", f), "utf8"))
      .join(" ")
      .replace(/\s+/g, " ");

    const citas = JSON.stringify(getGuiasParaRol("dueno")).matchAll(
      /«([^»]+)»/g,
    );
    const faltantes = [...citas]
      .map((cita) => cita[1])
      .filter((texto) => !interfaz.includes(texto));
    expect(faltantes).toEqual([]);
  });

  it("no repite ids", () => {
    const ids = getGuiasParaRol("dueno").map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buscarGuias", () => {
  const guias = getGuiasParaRol("dueno");

  it("sin búsqueda devuelve todo", () => {
    expect(buscarGuias(guias, "   ")).toEqual(guias);
  });

  it("ignora acentos y mayúsculas", () => {
    expect(buscarGuias(guias, "AUDITORIA").map((g) => g.id)).toContain(
      "auditoria",
    );
  });

  it("encuentra por palabras que no están en el título", () => {
    expect(buscarGuias(guias, "arqueo").map((g) => g.id)).toContain(
      "cerrar-caja",
    );
  });

  it("exige todas las palabras", () => {
    expect(buscarGuias(guias, "arqueo inflacion")).toEqual([]);
  });
});
