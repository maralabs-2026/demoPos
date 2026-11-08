import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

export type PuntoQr = {
  id: string;
  nombre: string;
  external_pos_id: string;
  activo: boolean;
};

export async function getPuntosQr(): Promise<ActionResult<PuntoQr[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mp_puntos")
    .select("id, nombre, external_pos_id, activo")
    .order("nombre");
  if (error) return fail("No pudimos cargar los QR.");
  return ok(data);
}
