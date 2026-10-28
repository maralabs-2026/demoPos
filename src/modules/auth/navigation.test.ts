import { describe, expect, it } from "vitest";
import { canAccess, getNavLinks, ROUTE_ROLES } from "./navigation";

function shape(rol: "dueno" | "encargado" | "cajero"): string[] {
  return getNavLinks(rol).map((link) => `${link.href}|${link.label}`);
}

describe("getNavLinks", () => {
  it("dueño ve los 5 accesos", () => {
    expect(shape("dueno")).toEqual([
      "/vender|Vender",
      "/productos|Productos",
      "/reportes|Reportes",
      "/config|Config",
      "/perfil|Mi perfil",
    ]);
  });

  it("encargado ve Reportes pero no Config", () => {
    expect(shape("encargado")).toEqual([
      "/vender|Vender",
      "/productos|Productos",
      "/reportes|Reportes",
      "/perfil|Mi perfil",
    ]);
  });

  it("cajero no ve Reportes ni Config", () => {
    expect(shape("cajero")).toEqual([
      "/vender|Vender",
      "/productos|Productos",
      "/perfil|Mi perfil",
    ]);
  });
});

describe("canAccess", () => {
  it("aplica ROUTE_ROLES por ruta y rol", () => {
    expect(canAccess("cajero", "/reportes")).toBe(false);
    expect(canAccess("cajero", "/config")).toBe(false);
    expect(canAccess("encargado", "/reportes")).toBe(true);
    expect(canAccess("encargado", "/config")).toBe(false);
    expect(canAccess("dueno", "/config")).toBe(true);
  });

  it("cada link de la navegación tiene su regla de acceso", () => {
    const rutas = Object.keys(ROUTE_ROLES);
    for (const rol of ["dueno", "encargado", "cajero"] as const) {
      for (const link of getNavLinks(rol)) {
        expect(rutas).toContain(link.href);
      }
    }
  });
});
