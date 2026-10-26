import type { Rol } from "./mock";

// Etiqueta y estilo de cada rol, para que navegación y perfil no se desincronicen.
export const ROL_LABELS: Record<Rol, string> = {
  dueno: "Dueño",
  encargado: "Encargado",
  cajero: "Cajero",
};

export function rolBadgeVariant(rol: Rol): "info" | "neutral" {
  return rol === "dueno" ? "info" : "neutral";
}
