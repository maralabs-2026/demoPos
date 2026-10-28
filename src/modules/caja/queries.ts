import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type CajaAbierta = {
  id: string;
  montoInicial: number;
  abiertaAt: string;
};

type CajaRow = { id: string; monto_inicial: number; abierta_at: string };

// La caja abierta del usuario de la sesión, o null si no tiene. Dueño y encargado ven todas las
// cajas por RLS, así que se filtra explícitamente por el usuario.
export async function getCajaAbierta(): Promise<
  ActionResult<CajaAbierta | null>
> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Volvé a ingresar.");

  const { data, error } = await supabase
    .from("cajas")
    .select("id, monto_inicial, abierta_at")
    .eq("usuario_id", user.id)
    .eq("estado", "abierta")
    .maybeSingle()
    .overrideTypes<CajaRow>();

  if (error) return fail("No se pudo leer el estado de tu caja.");
  if (!data) return ok(null);

  return ok({
    id: data.id,
    montoInicial: Number(data.monto_inicial),
    abiertaAt: data.abierta_at,
  });
}
