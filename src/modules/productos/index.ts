// Public API of the productos module. Other modules import only from here.
export { getProductos } from "./queries";
export { getCategorias } from "./categorias";
export type { Producto } from "./queries";
export type { Categoria } from "./categorias";

