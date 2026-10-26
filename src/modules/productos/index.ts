// Public API of the productos module. Other modules import only from here.
export { actualizarPrecios, crearProducto, editarProducto, eliminarProducto } from "./actions";
export type { PreciosActualizados, ProductoGuardado } from "./actions";
export { getCategorias, getProductos } from "./queries";
export type { Categoria, Producto } from "./queries";
export {
  actualizarPreciosSchema,
  calcularMargen,
  PORCENTAJE_MAX,
  PORCENTAJE_MIN,
  precioActualizado,
  productoSchema,
} from "./schemas";
export type { ActualizarPreciosInput, ProductoInput } from "./schemas";
