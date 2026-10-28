"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile } from "@/modules/auth";
import { getCajaAbierta, type CajaAbierta } from "./queries";
import { abrirCajaSchema, type AbrirCajaInput } from "./schemas";

const PG_UNIQUE_VIOLATION = "23505"; // cajas_una_abierta_por_usuario_idx

// Apertura de caja con monto inicial. El cierre, el arqueo y el historial llegan en la Fase 5;
// la apertura se adelantó a la Fase 4 porque registrar_venta exige una caja abierta.
export async function abrirCaja(
  input: AbrirCajaInput,
): Promise<ActionResult<CajaAbierta>> {
  const parsed = abrirCajaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Volvé a ingresar.");

  const { error } = await supabase.from("cajas").insert({
    comercio_id: profile.comercio_id,
    usuario_id: user.id,
    monto_inicial: parsed.data.montoInicial,
  });

  // Otra pestaña ya la abrió: se usa esa en vez de fallar.
  if (error && error.code !== PG_UNIQUE_VIOLATION) {
    return fail("No se pudo abrir la caja. Probá de nuevo.");
  }

  const caja = await getCajaAbierta();
  if (!caja.ok) return caja;
  if (!caja.data) return fail("No se pudo abrir la caja. Probá de nuevo.");

  revalidatePath("/vender");
  return ok(caja.data);
}
