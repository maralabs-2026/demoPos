import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function getComercioName(): Promise<ActionResult<string>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comercios")
    .select("nombre")
    .limit(1)
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("No hay ningún comercio cargado");
  return ok(data.nombre as string);
}

export type MedioPago = {
  id: string;
  nombre: string;
  tipo: "efectivo" | "tarjeta" | "transferencia" | "qr" | "cuenta_corriente";
};

export async function getMediosPago(): Promise<ActionResult<MedioPago[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medios_pago")
    .select("id, nombre, tipo")
    .eq("activo", true)
    .order("orden", { ascending: true })
    .overrideTypes<MedioPago[]>();

  if (error) return fail(error.message);
  return ok(data ?? []);
}
