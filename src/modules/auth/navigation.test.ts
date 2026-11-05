import { describe, expect, it } from "vitest";
import { canAccess, getNavLinks, ROUTE_ROLES } from "./navigation";

function shape(rol: "dueno" | "encargado" | "cajero"): string[] {
  return getNavLinks(rol).map((link) => `${link.href}|${link.label}`);
}

describe("getNavLinks", () => {
  it("dueño ve los 7 accesos", () => {
    expect(shape("dueno")).toEqual([
      "/vender|Vender",
      "/caja|Caja",
      "/productos|Productos",
      "/stock|Stock",
      "/reportes|Reportes",
      "/config|Config",
      "/perfil|Mi perfil",
    ]);
  });

  it("encargado ve Stock y Reportes pero no Config", () => {
    expect(shape("encargado")).toEqual([
      "/vender|Vender",
      "/caja|Caja",
      "/productos|Productos",
      "/stock|Stock",
      "/reportes|Reportes",
      "/perfil|Mi perfil",
    ]);
  });

  it("cajero ve Caja, pero no Stock, Reportes ni Config", () => {
    expect(shape("cajero")).toEqual([
      "/vender|Vender",
      "/caja|Caja",
      "/productos|Productos",
      "/perfil|Mi perfil",
    ]);
  });
});

describe("canAccess", () => {
  it("aplica ROUTE_ROLES por ruta y rol", () => {
    expect(canAccess("cajero", "/reportes")).toBe(false);
    expect(canAccess("cajero", "/config")).toBe(false);
    expect(canAccess("cajero", "/stock")).toBe(false);
    expect(canAccess("encargado", "/stock")).toBe(true);
    expect(canAccess("encargado", "/reportes")).toBe(true);
    expect(canAccess("encargado", "/config")).toBe(false);
    expect(canAccess("dueno", "/config")).toBe(true);
    expect(canAccess("cajero", "/caja")).toBe(true);
    expect(canAccess("cajero", "/caja/historial")).toBe(true);
    expect(canAccess("cajero", "/caja/cerrar")).toBe(false);
    expect(canAccess("encargado", "/caja/cerrar")).toBe(true);
    expect(canAccess("cajero", "/caja/gastos")).toBe(false);
    expect(canAccess("encargado", "/caja/gastos")).toBe(true);
    expect(canAccess("dueno", "/caja/gastos")).toBe(true);
    expect(canAccess("cajero", "/reportes/ventas")).toBe(false);
    expect(canAccess("encargado", "/reportes/ventas")).toBe(true);
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
