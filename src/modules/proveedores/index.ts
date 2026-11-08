// Public API of the proveedores module. Other modules import only from here.
export {
  cambiarActivoProveedor,
  crearProveedor,
  editarProveedor,
} from "./actions";
export { getProveedores } from "./queries";
export type { Proveedor } from "./queries";
export { proveedorSchema } from "./schemas";
export type { ProveedorInput } from "./schemas";
