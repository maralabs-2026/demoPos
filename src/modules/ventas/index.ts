// Public API of the ventas module. Other modules import only from here.
export { anularVenta, registrarVenta } from "./actions";
export type { Comprobante, ComprobanteItem } from "./actions";
export { getVenta, getVentas } from "./queries";
export type { VentaDetalle, VentaResumen } from "./queries";
export { anularVentaSchema, MOTIVO_ANULACION_MAX } from "./schemas";
export type { AnularVentaInput } from "./schemas";
export { enlaceWhatsApp, numeroTicket, ticketComoTexto } from "./ticket";
export type { TicketTextos } from "./ticket";
