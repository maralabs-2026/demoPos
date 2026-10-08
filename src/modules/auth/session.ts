export type Rol = "dueno" | "encargado" | "cajero";

// Server-side session profile resolved from public.perfiles + comercios.
export interface SessionProfile {
  email: string;
  rol: Rol;
  comercio_id: string;
  nombre: string;
  comercio: string;
  must_change_password: boolean;
}

export interface PerfilData {
  rol: Rol;
  comercio_id: string;
  nombre: string;
}

export function mustChangePasswordFromMetadata(metadata: unknown): boolean {
  if (typeof metadata !== "object" || metadata === null) return false;
  return (metadata as { must_change_password?: unknown }).must_change_password === true;
}

export function buildSessionProfile(
  email: string | null | undefined,
  metadata: unknown,
  perfil: PerfilData,
  comercioNombre: string | null | undefined,
): SessionProfile {
  return {
    email: email ?? "",
    rol: perfil.rol,
    comercio_id: perfil.comercio_id,
    nombre: perfil.nombre,
    comercio: comercioNombre ?? "",
    must_change_password: mustChangePasswordFromMetadata(metadata),
  };
}
