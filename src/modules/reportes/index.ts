// Public API of the reportes module. Other modules import only from here.
export { excelDeStock, excelDeVentas } from "./excel";
export { getCajeros, getReporteVentas, getVentasParaExportar } from "./queries";
export type { Cajero, ReporteVentas } from "./queries";
export { fechaValida, filtrosDesdeParams } from "./schemas";
export type { Agrupacion, FiltrosReporte } from "./schemas";
export { gananciaNeta, sinCostosCargados } from "./ganancia";
export { getInicio } from "./inicio";
export type { AvisoSinConexion, Inicio, TipoActividad } from "./inicio";
export { getReporteAnalisis } from "./analisis";
export type { ReporteAnalisis } from "./analisis";
export {
  anchoBarra,
  horasContinuas,
  margenCategoria,
  semanaCompleta,
} from "./analisis-calculos";
