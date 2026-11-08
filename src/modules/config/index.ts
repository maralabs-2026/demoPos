// Public API of the config module. Other modules import only from here.
export {
  cambiarActivoMedioPago,
  crearCategoria,
  crearMedioPago,
  eliminarCategoria,
  guardarAvisoVencimiento,
  guardarCorteDia,
  guardarLogo,
  guardarNombreComercio,
  guardarTicket,
  renombrarCategoria,
  quitarLogo,
  renombrarMedioPago,
} from "./actions";
export {
  getAvisoVencimiento,
  getComercioName,
  getCorteDiaComercial,
  getDescuentoMaxCajeroPct,
  getMediosPago,
  getMediosPagoConfig,
  getTicketConfig,
} from "./queries";
export type { MedioPago, MedioPagoConfig, TicketConfig } from "./queries";
export {
  AVISO_VENCIMIENTO_DEFECTO,
  AVISO_VENCIMIENTO_MAX,
  avisoVencimientoSchema,
  CORTE_DIA_MAX,
  corteDiaSchema,
  crearCategoriaSchema,
  crearMedioPagoSchema,
  MEDIOS_PAGO_MAX,
  NOMBRE_CONFIG_MAX,
  renombrarSchema,
  TEXTO_TICKET_MAX,
  ticketSchema,
  TIPOS_MEDIO_PAGO,
} from "./schemas";
export type {
  AvisoVencimientoInput,
  CorteDiaInput,
  CrearCategoriaInput,
  CrearMedioPagoInput,
  RenombrarInput,
  TicketInput,
} from "./schemas";
