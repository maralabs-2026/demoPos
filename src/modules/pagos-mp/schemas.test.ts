import { describe, expect, it } from "vitest";
import { iniciarCobroSchema, puntoQrSchema } from "./schemas";

describe("schemas de Mercado Pago", () => {
  it("valida el identificador del QR", () => {
    expect(
      puntoQrSchema.safeParse({ nombre: " Caja 1 ", externalPosId: "CAJA1" })
        .success,
    ).toBe(true);
    expect(
      puntoQrSchema.safeParse({ nombre: "Caja", externalPosId: "CAJA 1" })
        .success,
    ).toBe(false);
    expect(
      puntoQrSchema.safeParse({ nombre: " ", externalPosId: "CAJA1" }).success,
    ).toBe(false);
  });

  it("exige un monto positivo", () => {
    const puntoId = "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b";
    expect(iniciarCobroSchema.safeParse({ puntoId, monto: 10 }).success).toBe(
      true,
    );
    expect(iniciarCobroSchema.safeParse({ puntoId, monto: 0 }).success).toBe(
      false,
    );
  });
});
