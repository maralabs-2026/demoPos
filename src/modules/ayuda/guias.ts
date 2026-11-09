import { canAccess, type Rol } from "@/modules/auth";
import type { Guia } from "./buscar";
import { GUIAS_MERCADERIA } from "./guias-mercaderia";
import { GUIAS_MOSTRADOR } from "./guias-mostrador";

const GUIAS: readonly Guia[] = [...GUIAS_MOSTRADOR, ...GUIAS_MERCADERIA];

// Se filtra en el servidor: las guías de otro rol no llegan al navegador.
export function getGuiasParaRol(rol: Rol): readonly Guia[] {
  return GUIAS.filter(
    (guia) => guia.roles.includes(rol) && canAccess(rol, guia.ruta),
  );
}
