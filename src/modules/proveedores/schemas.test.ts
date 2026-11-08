import { describe, expect, it } from "vitest";
import { proveedorSchema } from "./schemas";

const base = { nombre: "Distribuidora", telefono: "", nota: "" };

describe("proveedorSchema", () => {
  it("deja el teléfono solo con dígitos y vacío como null", () => {
    const conFormato = proveedorSchema.safeParse({
      ...base,
      telefono: "+54 9 351 123-4567",
    });
    expect(conFormato.success && conFormato.data.telefono).toBe(
      "5493511234567",
    );
    const vacio = proveedorSchema.safeParse(base);
    expect(vacio.success && vacio.data.telefono).toBeNull();
  });

  it("rechaza un teléfono corto, un nombre vacío y una nota larga", () => {
    expect(
      proveedorSchema.safeParse({ ...base, telefono: "123" }).success,
    ).toBe(false);
    expect(proveedorSchema.safeParse({ ...base, nombre: "  " }).success).toBe(
      false,
    );
    expect(
      proveedorSchema.safeParse({ ...base, nota: "x".repeat(301) }).success,
    ).toBe(false);
  });
});
