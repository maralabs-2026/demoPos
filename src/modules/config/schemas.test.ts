import { describe, expect, it } from "vitest";
import {
  crearCategoriaSchema,
  crearMedioPagoSchema,
  NOMBRE_CONFIG_MAX,
  renombrarSchema,
  TEXTO_TICKET_MAX,
  ticketSchema,
} from "./schemas";

const ID = "7d3f9a52-1c64-4b8e-9f21-3a5c7e9d1b20";

describe("ticketSchema", () => {
  it("exige título y permite leyenda y pie vacíos", () => {
    expect(
      ticketSchema.parse({ titulo: " Kiosko ", leyenda: "", pie: "  " }),
    ).toEqual({ titulo: "Kiosko", leyenda: "", pie: "" });
    expect(
      ticketSchema.safeParse({ titulo: "  ", leyenda: "", pie: "" }).success,
    ).toBe(false);
  });

  it("limita el largo de los textos", () => {
    expect(
      ticketSchema.safeParse({
        titulo: "Kiosko",
        leyenda: "x".repeat(TEXTO_TICKET_MAX + 1),
        pie: "",
      }).success,
    ).toBe(false);
  });
});

describe("crearMedioPagoSchema", () => {
  it("acepta los tipos que se ofrecen", () => {
    expect(
      crearMedioPagoSchema.safeParse({ nombre: "Cuenta DNI", tipo: "qr" })
        .success,
    ).toBe(true);
  });

  it.each([
    ["cuenta corriente, que todavía no se ofrece", "cuenta_corriente"],
    ["un tipo desconocido", "cheque"],
  ])("rechaza %s", (_, tipo) => {
    expect(
      crearMedioPagoSchema.safeParse({ nombre: "Medio", tipo }).success,
    ).toBe(false);
  });
});

describe("nombres", () => {
  it("recortan espacios y rechazan vacíos o largos", () => {
    expect(crearCategoriaSchema.parse({ nombre: " Bebidas " }).nombre).toBe(
      "Bebidas",
    );
    expect(crearCategoriaSchema.safeParse({ nombre: "  " }).success).toBe(
      false,
    );
    expect(
      renombrarSchema.safeParse({
        id: ID,
        nombre: "x".repeat(NOMBRE_CONFIG_MAX + 1),
      }).success,
    ).toBe(false);
    expect(renombrarSchema.safeParse({ id: "x", nombre: "A" }).success).toBe(
      false,
    );
  });
});
