// Public API of the productos module. Other modules import only from here.
export { getCategorias, getProductos } from "./queries";
export type { Categoria, Producto } from "./queries";
