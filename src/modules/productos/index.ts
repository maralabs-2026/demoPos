// Public API of the productos module. Other modules import only from here.
export {
  actualizarPrecios,
  crearCategoriaRapida,
  crearProducto,
  editarProducto,
  eliminarProducto,
  guardarFotoProducto,
  importarProductos,
  quitarFotoProducto,
} from "./actions";
export type {
  CategoriaCreada,
  PreciosActualizados,
  ProductoGuardado,
  ProductosImportados,
} from "./actions";
export { getCategorias, getProductos } from "./queries";
export type { Categoria, Producto } from "./queries";
export {
  actualizarPreciosSchema,
  calcularMargen,
  PORCENTAJE_MAX,
  PORCENTAJE_MIN,
  precioActualizado,
  precioDesdeMargen,
  productoSchema,
  STOCK_INICIAL_MAX,
  stockInicialSchema,
} from "./schemas";
export type { ActualizarPreciosInput, ProductoInput } from "./schemas";
