import { cache } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  buildSessionProfile,
  type SessionProfile,
  type PerfilData,
} from "./session";

type PerfilRow = PerfilData & {
  comercios: { nombre: string } | null;
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
      .select("rol, comercio_id, nombre, comercios(nombre)")
      .eq("id", user.id)
      .maybeSingle()
      .overrideTypes<PerfilRow>();

    if (error || !data) return null;

    return buildSessionProfile(
      user.email,
      user.user_metadata,
      data,
      data.comercios?.nombre,
    );
  },
);
