// Public API of the ventas module. Other modules import only from here.
export { anularVenta, enviarVentaSinConexion, registrarVenta } from "./actions";
export type {
  AvisoSinConexion,
  Comprobante,
  ComprobanteItem,
  EnvioSinConexion,
} from "./actions";
export { getVenta, getVentas } from "./queries";
export type { VentaDetalle, VentaResumen } from "./queries";
export {
  anularVentaSchema,
  MOTIVO_ANULACION_MAX,
  ventaSinConexionSchema,
} from "./schemas";
export type { AnularVentaInput, VentaSinConexionInput } from "./schemas";
export { enlaceWhatsApp, numeroTicket, ticketComoTexto } from "./ticket";
export type { TicketTextos } from "./ticket";
