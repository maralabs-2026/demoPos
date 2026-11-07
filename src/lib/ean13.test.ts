import { describe, expect, it } from "vitest";
import {
  MODULOS_EAN13,
  barrasEan13,
  digitoVerificador,
  esCodigoInterno,
  esEan13,
} from "./ean13";

describe("digitoVerificador", () => {
  it("coincide con códigos EAN-13 conocidos", () => {
    expect(digitoVerificador("400638133393")).toBe(1);
    expect(digitoVerificador("590123412345")).toBe(7);
  });

  it("coincide con los códigos internos que genera la base", () => {
    expect(digitoVerificador("200000000001")).toBe(5);
    expect(digitoVerificador("200000000002")).toBe(2);
    expect(digitoVerificador("200000000006")).toBe(0);
  });

  it("rechaza un cuerpo que no tiene 12 dígitos", () => {
    expect(() => digitoVerificador("12345")).toThrow();
    expect(() => digitoVerificador("20000000000a")).toThrow();
  });
});

describe("esEan13 y esCodigoInterno", () => {
  it("valida el dígito verificador", () => {
    expect(esEan13("4006381333931")).toBe(true);
    expect(esEan13("4006381333932")).toBe(false);
    expect(esEan13("400638133393")).toBe(false);
    expect(esEan13("ABC")).toBe(false);
  });

  it("reconoce el prefijo interno 20", () => {
    expect(esCodigoInterno("2000000000015")).toBe(true);
    expect(esCodigoInterno("4006381333931")).toBe(false);
    expect(esCodigoInterno("2000000000016")).toBe(false);
  });
});

describe("barrasEan13", () => {
  it("arma los 95 módulos con guardas al inicio, al centro y al final", () => {
    const barras = barrasEan13("4006381333931");
    expect(barras).not.toBeNull();
    expect(barras).toHaveLength(MODULOS_EAN13);
    expect(barras!.slice(0, 3)).toBe("101");
    expect(barras!.slice(45, 50)).toBe("01010");
    expect(barras!.slice(92)).toBe("101");
  });

  it("codifica la mitad izquierda según el primer dígito y la derecha con R", () => {
    // Primer dígito 4: paridad LGLLGG. El segundo dígito (0) va con L y el tercero (0) con G.
    const barras = barrasEan13("4006381333931")!;
    expect(barras.slice(3, 10)).toBe("0001101");
    expect(barras.slice(10, 17)).toBe("0100111");
    // Último dígito (1) con R.
    expect(barras.slice(85, 92)).toBe("1100110");
  });

  it("devuelve null si el código no es un EAN-13 válido", () => {
    expect(barrasEan13("7791234")).toBeNull();
    expect(barrasEan13("4006381333932")).toBeNull();
  });
});
