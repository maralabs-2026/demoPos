import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  codigoDeLecturas,
  confirmarLectura,
  mensajeErrorCamara,
  ZXING_WASM_PATH,
} from "./codigos";

describe("codigoDeLecturas", () => {
  it("devuelve el primer código de un formato buscado", () => {
    expect(
      codigoDeLecturas([
        { rawValue: "https://ejemplo.com", format: "qr_code" },
        { rawValue: " 7790895000782 ", format: "ean_13" },
        { rawValue: "123", format: "code_128" },
      ]),
    ).toBe("7790895000782");
  });

  it("ignora vacíos y formatos que no se buscan", () => {
    expect(codigoDeLecturas([])).toBeNull();
    expect(codigoDeLecturas([{ rawValue: "  ", format: "ean_13" }])).toBeNull();
    expect(codigoDeLecturas([{ rawValue: "x", format: "qr_code" }])).toBeNull();
  });
});

describe("confirmarLectura", () => {
  it("confirma recién cuando el mismo código se lee dos veces seguidas", () => {
    let estado = confirmarLectura(null, "779");
    expect(estado).toEqual({ confirmado: null, pendiente: "779" });
    estado = confirmarLectura(estado.pendiente, "779");
    expect(estado).toEqual({ confirmado: "779", pendiente: null });
  });

  it("un código distinto o un cuadro sin código reinicia la espera", () => {
    expect(confirmarLectura("779", "123")).toEqual({
      confirmado: null,
      pendiente: "123",
    });
    expect(confirmarLectura("779", null)).toEqual({
      confirmado: null,
      pendiente: null,
    });
  });
});

describe("mensajeErrorCamara", () => {
  it("explica el permiso denegado y la falta de cámara", () => {
    expect(mensajeErrorCamara("NotAllowedError")).toMatch(/permiso/);
    expect(mensajeErrorCamara("NotFoundError")).toMatch(/No encontramos/);
    expect(mensajeErrorCamara(undefined)).toMatch(/escribí el código/);
  });
});

describe("lector servido desde el sitio", () => {
  it("la copia en public coincide con la versión instalada de zxing-wasm", () => {
    const hash = (ruta: string) =>
      createHash("sha256").update(readFileSync(ruta)).digest("hex");
    const publico = join(process.cwd(), "public", ZXING_WASM_PATH);
    const instalado = join(
      process.cwd(),
      "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
    );
    expect(hash(publico)).toBe(hash(instalado));
  });
});
