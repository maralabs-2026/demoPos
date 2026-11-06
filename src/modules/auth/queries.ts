import { cache } from "react";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { LOGO_BUCKET } from "@/lib/logo";
import {
  buildSessionProfile,
  type Rol,
  type SessionProfile,
  type PerfilData,
} from "./session";

type PerfilRow = PerfilData & {
  comercios: { nombre: string; logo_path: string | null } | null;
};

// cache(): el layout, el guard y la página piden el perfil en la misma request; se resuelve una vez.
export const getAuthProfile = cache(
  async (): Promise<SessionProfile | null> => {
    if (!isSupabaseConfigured()) return null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from("perfiles")
      .select("rol, comercio_id, nombre, comercios(nombre, logo_path)")
      .eq("id", user.id)
      // Un usuario desactivado no tiene sesión, aunque su token siga vigente.
      .eq("activo", true)
      .maybeSingle()
      .overrideTypes<PerfilRow>();

    if (error || !data) return null;

    return buildSessionProfile(
      user.email,
      // app_metadata: el usuario no la puede escribir (user_metadata sí, desde el navegador).
      user.app_metadata,
      data,
      data.comercios?.nombre,
      data.comercios?.logo_path
        ? supabase.storage
            .from(LOGO_BUCKET)
            .getPublicUrl(data.comercios.logo_path).data.publicUrl
        : null,
    );
  },
);

export type Usuario = {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  email: string;
  contrasenaTemporal: boolean;
  // Si quien mira lo puede modificar: el dueño a todos menos a sí mismo; el encargado, a los cajeros.
  administrable: boolean;
};

type UsuarioRow = {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  email: string;
  contrasena_temporal: boolean;
  administrable: boolean;
};

export async function getUsuarios(): Promise<ActionResult<Usuario[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_usuarios");
  if (error) return fail("No se pudieron leer los usuarios.");

  return ok(
    (data as UsuarioRow[]).map((u) => ({
      id: u.id,
      nombre: u.nombre,
      rol: u.rol,
      activo: u.activo,
      email: u.email,
      contrasenaTemporal: u.contrasena_temporal,
      administrable: u.administrable,
    })),
  );
}
