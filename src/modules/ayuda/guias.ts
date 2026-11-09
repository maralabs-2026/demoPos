import { canAccess, type Rol } from "@/modules/auth";
import type { Guia } from "./buscar";
import { GUIAS_ADMINISTRACION } from "./guias-administracion";
import { GUIAS_MERCADERIA } from "./guias-mercaderia";
import { GUIAS_MOSTRADOR } from "./guias-mostrador";
import { GUIAS_NEGOCIO } from "./guias-negocio";

const GUIAS: readonly Guia[] = [
  ...GUIAS_MOSTRADOR,
  ...GUIAS_MERCADERIA,
  ...GUIAS_NEGOCIO,
  ...GUIAS_ADMINISTRACION,
];

// Se filtra en el servidor: las guías de otro rol no llegan al navegador.
export function getGuiasParaRol(rol: Rol): readonly Guia[] {
  return GUIAS.filter(
    (guia) => guia.roles.includes(rol) && canAccess(rol, guia.ruta),
  );
}
