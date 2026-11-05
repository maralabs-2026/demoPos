// Public API of the config module. Other modules import only from here.
export {
  getComercioName,
  getDescuentoMaxCajeroPct,
  getMediosPago,
  getTicketConfig,
} from "./queries";
export type { MedioPago, TicketConfig } from "./queries";
