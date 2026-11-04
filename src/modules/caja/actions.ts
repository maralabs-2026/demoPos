"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile } from "@/modules/auth";
import { getCajaAbierta, type CajaAbierta } from "./queries";
import {
  abrirCajaSchema,
  cerrarCajaSchema,
  type AbrirCajaInput,
  type CerrarCajaInput,
} from "./schemas";

const PG_UNIQUE_VIOLATION = "23505"; // cajas_una_abierta_por_usuario_idx
const PV_CAJA_INVALIDA = "PV002";
const PV_CAJA_CERRADA = "PV012";
const PV_CONTEO_INVALIDO = "PV014";

// Cierra con el conteo por medio de pago: cerrar_caja calcula el esperado y la diferencia en la
// misma transacción. Devuelve la caja para mostrar el resultado en su detalle.
export async function cerrarCaja(
  input: CerrarCajaInput,
): Promise<ActionResult<{ cajaId: string }>> {
  const parsed = cerrarCajaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cerrar_caja", {
    p_caja_id: parsed.data.cajaId,
    p_conteos: parsed.data.conteos.map((c) => ({
      medio_pago_id: c.medioPagoId,
      contado: c.contado,
    })),
    p_nota: parsed.data.nota,
  });

  if (error) {
    switch (error.code) {
      case PV_CAJA_INVALIDA:
        return fail("Esta caja no existe o no la podés cerrar.");
      case PV_CAJA_CERRADA:
        return fail("Esta caja ya está cerrada.");
      case PV_CONTEO_INVALIDO:
        // "Falta contar Débito": el mensaje lo arma la base con el medio que falta.
        return fail(
          error.message.startsWith("Falta contar")
            ? `${error.message}. Recargá la página si no lo ves.`
            : "El conteo no es válido. Revisá los montos.",
        );
      default:
        return fail("No se pudo cerrar la caja. Probá de nuevo.");
    }
  }

  revalidatePath("/caja");
  revalidatePath("/caja/historial");
  revalidatePath("/vender");
  return ok({ cajaId: parsed.data.cajaId });
}

// Apertura de caja con monto inicial. Se adelantó a la Fase 4 porque registrar_venta exige una caja
// abierta.
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
