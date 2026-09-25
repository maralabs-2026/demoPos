import { describe, expect, it } from "vitest";
import { splitBrandName } from "./brand";

describe("splitBrandName", () => {
  it("divide un nombre de dos palabras en monograma, primera y resto", () => {
    expect(splitBrandName("Kiosko Demo")).toEqual({
      monogram: "K",
      first: "Kiosko",
      rest: "Demo",
    });
  });

  it("normaliza el monograma a mayúscula", () => {
    expect(splitBrandName("kiosko demo").monogram).toBe("K");
  });

  it("deja rest vacío para un nombre de una sola palabra", () => {
    expect(splitBrandName("Autoservicio")).toEqual({
      monogram: "A",
      first: "Autoservicio",
      rest: "",
    });
  });

  it("une las palabras restantes con espacios", () => {
    expect(splitBrandName("Kiosco Central - Sucursal 01")).toEqual({
      monogram: "K",
      first: "Kiosco",
      rest: "Central - Sucursal 01",
    });
  });

  it("tolera espacios externos y repetidos", () => {
    expect(splitBrandName("   Kiosko    Demo   ")).toEqual({
      monogram: "K",
      first: "Kiosko",
      rest: "Demo",
    });
  });

  it("devuelve partes vacías para un nombre en blanco", () => {
    expect(splitBrandName("   ")).toEqual({
      monogram: "",
      first: "",
      rest: "",
    });
  });
});