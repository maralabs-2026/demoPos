import { describe, expect, it } from "vitest";
import { LOGO_MAX_BYTES } from "@/lib/logo";
import {
  comercioNombreSchema,
  CORTE_DIA_MAX,
  corteDiaSchema,
  crearCategoriaSchema,
  crearMedioPagoSchema,
  NOMBRE_CONFIG_MAX,
  renombrarSchema,
  TEXTO_TICKET_MAX,
  logoSchema,
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

describe("comercioNombreSchema", () => {
  it("recorta espacios y rechaza vacío o largo", () => {
    expect(comercioNombreSchema.parse({ nombre: " Zona 24/7 " }).nombre).toBe(
      "Zona 24/7",
    );
    expect(comercioNombreSchema.safeParse({ nombre: " " }).success).toBe(false);
    expect(
      comercioNombreSchema.safeParse({
        nombre: "x".repeat(NOMBRE_CONFIG_MAX + 1),
      }).success,
    ).toBe(false);
  });
});

describe("logoSchema", () => {
  const archivo = (bytes: number) =>
    new File([new Uint8Array(bytes)], "logo.png", { type: "image/png" });

  it("acepta hasta 512 KB y rechaza vacío o más pesado", () => {
    expect(
      logoSchema.safeParse({ logo: archivo(LOGO_MAX_BYTES) }).success,
    ).toBe(true);
    expect(logoSchema.safeParse({ logo: archivo(0) }).success).toBe(false);
    expect(
      logoSchema.safeParse({ logo: archivo(LOGO_MAX_BYTES + 1) }).error
        ?.issues[0]?.message,
    ).toBe("La imagen puede pesar hasta 512 KB");
    expect(logoSchema.safeParse({ logo: null }).success).toBe(false);
  });
});

describe("corteDiaSchema", () => {
  it("acepta horas en punto de 0 a 12", () => {
    expect(corteDiaSchema.safeParse({ horas: 0 }).success).toBe(true);
    expect(corteDiaSchema.safeParse({ horas: CORTE_DIA_MAX }).success).toBe(
      true,
    );
  });

  it("rechaza horas fuera de rango, con minutos o que no son números", () => {
    expect(corteDiaSchema.safeParse({ horas: 13 }).success).toBe(false);
    expect(corteDiaSchema.safeParse({ horas: -1 }).success).toBe(false);
    expect(corteDiaSchema.safeParse({ horas: 5.5 }).success).toBe(false);
    expect(corteDiaSchema.safeParse({ horas: "6" }).success).toBe(false);
    expect(corteDiaSchema.safeParse({ horas: undefined }).success).toBe(false);
  });
});
