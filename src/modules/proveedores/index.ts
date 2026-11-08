// Public API of the proveedores module. Other modules import only from here.
export {
  cambiarActivoProveedor,
  crearProveedor,
  editarProveedor,
  registrarCompra,
} from "./actions";
export type { CompraRegistrada, CostoQueSubio } from "./actions";
export { getCompras, getProveedores } from "./queries";
export type { Compra, Proveedor } from "./queries";
export { compraSchema, proveedorSchema } from "./schemas";
export type { CompraInput, ProveedorInput } from "./schemas";
