import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaValida } from "./firma";

const secreto = "secreto-de-prueba";
const firmar = (manifiesto: string, clave = secreto) =>
  createHmac("sha256", clave).update(manifiesto).digest("hex");

describe("firma del webhook", () => {
  const manifiesto = "id:ord01abc;request-id:req-1;ts:1700000000000;";
  const base = {
    requestId: "req-1",
    dataId: "ORD01ABC",
    secreto,
    header: `ts=1700000000000,v1=${firmar(manifiesto)}`,
  };

  it("acepta la firma correcta y pasa el id a minúsculas", () => {
    expect(firmaValida(base)).toBe(true);
  });

  it("omite los segmentos que faltan", () => {
    const header = `ts=5,v1=${firmar("request-id:req-1;ts:5;")}`;
    expect(firmaValida({ ...base, dataId: null, header })).toBe(true);
  });

  it("rechaza otro id, otra clave o un encabezado incompleto", () => {
    expect(firmaValida({ ...base, dataId: "ORD02" })).toBe(false);
    expect(firmaValida({ ...base, secreto: "otra" })).toBe(false);
    expect(firmaValida({ ...base, secreto: "" })).toBe(false);
    expect(firmaValida({ ...base, header: null })).toBe(false);
    expect(firmaValida({ ...base, header: "ts=1" })).toBe(false);
    expect(firmaValida({ ...base, header: "ts=1,v1=abc" })).toBe(false);
  });
});
