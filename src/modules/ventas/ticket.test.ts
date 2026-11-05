import { describe, expect, it } from "vitest";
import type { Comprobante } from "./actions";
import { enlaceWhatsApp, numeroTicket, ticketComoTexto } from "./ticket";

const VENTA: Comprobante = {
  ventaId: "abcd1234-0000-4000-8000-000000000000",
  items: [
    {
      nombre: "Coca-Cola 500ml",
      cantidad: 2,
      precioUnitario: 2500,
      descuento: 0,
      promocion: "2x1",
      subtotal: 2500,
    },
  ],
  total: 2250,
  descuentoTotal: 250,
  medioPagoNombre: "Efectivo",
  vuelto: 0,
  fecha: "2026-11-05T13:00:00Z",
};

const TEXTOS = {
  titulo: "Kiosko",
  leyenda: "Ticket no fiscal",
  pie: "Gracias",
};

describe("ticketComoTexto", () => {
  it("arma el texto con los snapshots de la venta y los textos configurados", () => {
    const texto = ticketComoTexto(VENTA, TEXTOS);
    expect(texto).toContain("Kiosko");
    expect(texto).toContain("Ticket ABCD1234 · 05/11/2026, 10:00");
    expect(texto).toContain("2 × Coca-Cola 500ml: $ 2.500,00");
    expect(texto).toContain("Promo: 2x1");
    expect(texto).toContain("Descuento: − $ 250,00");
    expect(texto).toContain("Total: $ 2.250,00");
    expect(texto).toContain("Ticket no fiscal");
    expect(texto).toContain("Gracias");
  });

  it("omite lo que no aplica, sin dejar líneas vacías de más", () => {
    const texto = ticketComoTexto(
      { ...VENTA, descuentoTotal: 0 },
      { titulo: "", leyenda: "", pie: "" },
    );
    expect(texto).not.toContain("Descuento");
    expect(texto).not.toMatch(/\n{3,}/);
    expect(texto.startsWith("Ticket")).toBe(true);
  });
});

describe("enlaceWhatsApp", () => {
  it("codifica el texto y no incluye un destinatario", () => {
    expect(enlaceWhatsApp("Total: $ 1 & más")).toBe(
      "https://wa.me/?text=Total%3A%20%24%201%20%26%20m%C3%A1s",
    );
  });
  it("numeroTicket usa los primeros ocho caracteres", () => {
    expect(numeroTicket("abcd1234-rest")).toBe("ABCD1234");
  });
});
