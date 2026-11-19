// Public API of the caja module. Other modules import only from here.
export {
  abrirCaja,
  anularGasto,
  cerrarCaja,
  generarCodigoAjuste,
  pagarGasto,
  registrarAjusteCaja,
  registrarGasto,
  registrarMovimiento,
  verificarTransferencia,
} from "./actions";
export {
  contarCajasAbiertas,
  getCajaAbierta,
  getCajaAbiertaPorId,
  getCajaCerrada,
  getCajasAbiertasDeOtros,
  getCajasParaPagar,
  getCierresEntre,
  getGastos,
  getHistorialCajas,
  getMediosAContar,
  getMovimientosCaja,
  getTransferencias,
  getVentasCaja,
} from "./queries";
export type {
  CajaAbierta,
  CajaCerrada,
  CajaDeOtro,
  CajaParaPagar,
  Gasto,
  MedioAContar,
  MovimientoCaja,
} from "./queries";
export {
  desgloseCierre,
  estadoDiferencia,
  resumenDelDia,
  totalesCierre,
} from "./cierre";
export type {
  DesgloseMedio,
  EstadoDiferencia,
  LineaCierre,
  LineaDelDia,
  VentaDeCaja,
} from "./cierre";
export { estaVencido } from "./gastos";
export {
  estadoTransferencia,
  resumenTransferencias,
  transferenciasPorResolver,
} from "./transferencias";
export type {
  EstadoTransferencia,
  PorResolver,
  Transferencia,
} from "./transferencias";
export {
  abrirCajaSchema,
  cerrarCajaSchema,
  DESCRIPCION_GASTO_MAX,
  generarCodigoAjusteSchema,
  MOTIVO_MOVIMIENTO_MAX,
  NOTA_CIERRE_MAX,
  pagarGastoSchema,
  registrarAjusteSchema,
  registrarGastoSchema,
  registrarMovimientoSchema,
  verificarTransferenciaSchema,
} from "./schemas";
export type {
  AbrirCajaInput,
  CerrarCajaInput,
  GenerarCodigoAjusteInput,
  PagarGastoInput,
  RegistrarAjusteInput,
  RegistrarGastoInput,
  RegistrarMovimientoInput,
  VerificarTransferenciaInput,
} from "./schemas";
