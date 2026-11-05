// Public API of the config module. Other modules import only from here.
export {
  cambiarActivoMedioPago,
  crearCategoria,
  crearMedioPago,
  eliminarCategoria,
  guardarTicket,
  renombrarCategoria,
  renombrarMedioPago,
} from "./actions";
export {
  getComercioName,
  getDescuentoMaxCajeroPct,
  getMediosPago,
  getMediosPagoConfig,
  getTicketConfig,
} from "./queries";
export type { MedioPago, MedioPagoConfig, TicketConfig } from "./queries";
export {
  crearCategoriaSchema,
  crearMedioPagoSchema,
  NOMBRE_CONFIG_MAX,
  renombrarSchema,
  TEXTO_TICKET_MAX,
  ticketSchema,
  TIPOS_MEDIO_PAGO,
} from "./schemas";
export type {
  CrearCategoriaInput,
  CrearMedioPagoInput,
  RenombrarInput,
  TicketInput,
} from "./schemas";
