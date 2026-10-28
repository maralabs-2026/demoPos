import { redirect } from "next/navigation";
import { canAccess, type AppRoute } from "./navigation";
import { getAuthProfile } from "./queries";
import type { SessionProfile } from "./session";
import { mustChangePassword } from "./session-guard";

// Guard del servidor para cada página restringida: en el App Router el layout no conoce la ruta,
// así que cada página lo llama arriba de todo. Ocultar el link es comodidad; esto es la barrera
// de la interfaz (la de los datos sigue siendo la RLS).
export async function requireRol(route: AppRoute): Promise<SessionProfile> {
  const profile = await getAuthProfile();
  if (!profile) redirect("/login");
  if (mustChangePassword(profile)) redirect("/cambiar-contrasena");
  if (!canAccess(profile.rol, route)) redirect("/vender");
  return profile;
}
