// Public API of the stock module. Other modules import only from here.
export { aplicarAuditoria, registrarAjuste, registrarIngreso } from "./actions";
export type { LineaAuditoria, MovimientoRegistrado } from "./actions";
export { getMovimientos, getProductosAContar } from "./queries";
export type { Movimiento, ProductoAContar, TipoMovimiento } from "./queries";
export { ajusteSchema, auditoriaSchema, ingresoSchema } from "./schemas";
export type { AjusteInput, AuditoriaInput, IngresoInput } from "./schemas";
export {
  agruparPorProveedor,
  reposicionComoTexto,
  sugerirReposicion,
} from "./reposicion";
export type { LineaReposicion, PedidoProveedor } from "./reposicion";
