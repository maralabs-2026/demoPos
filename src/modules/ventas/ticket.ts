import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import type { Comprobante } from "./actions";

export type TicketTextos = { titulo: string; leyenda: string; pie: string };

// Número corto para identificar la venta en el mostrador.
export function numeroTicket(ventaId: string): string {
  return ventaId.slice(0, 8).toUpperCase();
}

// El ticket como texto, para compartirlo por WhatsApp. Sin datos del cliente: solo la venta.
export function ticketComoTexto(
  venta: Comprobante,
  textos: TicketTextos,
): string {
  const lineas = [
    textos.titulo,
    `Ticket ${numeroTicket(venta.ventaId)} · ${formatDateTime(venta.fecha)}`,
    "",
    ...venta.items.flatMap((item) => [
      `${item.cantidad} × ${item.nombre}: ${formatCurrency(item.subtotal)}`,
      ...(item.promocion ? [`  Promo: ${item.promocion}`] : []),
    ]),
    "",
    ...(venta.descuentoTotal > 0
      ? [`Descuento: − ${formatCurrency(venta.descuentoTotal)}`]
      : []),
    `Total: ${formatCurrency(venta.total)}`,
    `Pago: ${venta.medioPagoNombre}`,
    "",
    textos.leyenda,
    textos.pie,
  ];
  return lineas
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function enlaceWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
