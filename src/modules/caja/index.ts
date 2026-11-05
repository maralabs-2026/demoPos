// Public API of the caja module. Other modules import only from here.
export { abrirCaja, cerrarCaja, registrarMovimiento } from "./actions";
export {
  getCajaAbierta,
  getCajaAbiertaPorId,
  getCajaCerrada,
  getCajasAbiertasDeOtros,
  getHistorialCajas,
  getMediosAContar,
  getMovimientosCaja,
} from "./queries";
export type {
  CajaAbierta,
  CajaCerrada,
  CajaDeOtro,
  MedioAContar,
  MovimientoCaja,
} from "./queries";
export { estadoDiferencia, totalesCierre } from "./cierre";
export type { EstadoDiferencia, LineaCierre } from "./cierre";
export {
  abrirCajaSchema,
  cerrarCajaSchema,
  MOTIVO_MOVIMIENTO_MAX,
  NOTA_CIERRE_MAX,
  registrarMovimientoSchema,
} from "./schemas";
export type {
  AbrirCajaInput,
  CerrarCajaInput,
  RegistrarMovimientoInput,
} from "./schemas";
