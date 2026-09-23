import { describe, expect, it } from "vitest";
import { getNavLinks } from "./navigation";

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

  it("encargado no ve Reportes ni Config", () => {
    expect(shape("encargado")).toEqual([
      "/vender|Vender",
      "/productos|Productos",
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
