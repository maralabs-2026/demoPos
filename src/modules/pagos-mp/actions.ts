"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { getAuthProfile } from "@/modules/auth";
import { cancelarOrden, crearOrden } from "./cliente";
import {
  cobroIdSchema,
  iniciarCobroSchema,
  puntoQrSchema,
  type IniciarCobroInput,
  type PuntoQrInput,
} from "./schemas";
import { sincronizarOrden } from "./sincronizar";

const PG_UNIQUE = "23505";
const SIN_SESION = "Tu sesión venció. Volvé a ingresar.";
const SOLO_DUENO = "Solo el dueño puede administrar los QR.";
const COBRO_INVALIDO = "Ese cobro ya no está disponible.";

const ERRORES: Record<string, string> = {
  PV029: "Ese QR no está disponible.",
  PV030: "Ese QR tiene otro cobro en curso. Cancelalo o esperá unos minutos.",
  PV031: COBRO_INVALIDO,
};

export type EstadoCobroQr = { estado: string; orderId: string | null };

async function leerCobro(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mp_cobros")
    .select("estado, order_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function iniciarCobroQr(
  input: IniciarCobroInput,
): Promise<ActionResult<{ cobroId: string }>> {
  const parsed = iniciarCobroSchema.safeParse(input);
  if (!parsed.success) return fail("Datos del cobro inválidos.");
  if (!(await getAuthProfile())) return fail(SIN_SESION);

  const { puntoId, monto } = parsed.data;
  const supabase = await createClient();
  const { data: punto } = await supabase
    .from("mp_puntos")
    .select("external_pos_id")
    .eq("id", puntoId)
    .maybeSingle();
  if (!punto) return fail(ERRORES.PV029);

  const { data: cobroId, error } = await supabase.rpc("crear_mp_cobro", {
    p_punto_id: puntoId,
    p_monto: monto,
  });
  if (error) return fail(ERRORES[error.code] ?? "No se pudo iniciar el cobro.");

  const orden = await crearOrden({
    cobroId,
    monto,
    externalPosId: punto.external_pos_id,
  });
  if (!orden.ok) {
    await supabase.rpc("cancelar_mp_cobro", { p_cobro_id: cobroId });
    return orden;
  }

  const { error: errorOrden } = await supabase.rpc("fijar_orden_mp_cobro", {
    p_cobro_id: cobroId,
    p_order_id: orden.data.id,
  });
  if (errorOrden) {
    await cancelarOrden(orden.data.id, cobroId);
    await supabase.rpc("cancelar_mp_cobro", { p_cobro_id: cobroId });
    return fail("No se pudo iniciar el cobro.");
  }
  return ok({ cobroId });
}

// La lectura pasa por la RLS: solo se consulta a Mercado Pago un cobro que el usuario puede ver.
// Consultar además del webhook cubre un aviso demorado o perdido.
export async function consultarCobroQr(
  id: string,
): Promise<ActionResult<EstadoCobroQr>> {
  if (!cobroIdSchema.safeParse(id).success) return fail(COBRO_INVALIDO);
  const cobro = await leerCobro(id);
  if (!cobro) return fail(COBRO_INVALIDO);

  if (cobro.estado === "pendiente" && cobro.order_id) {
    const sync = await sincronizarOrden(cobro.order_id);
    if (sync.ok && sync.data) {
      return ok({ estado: sync.data, orderId: cobro.order_id });
    }
  }
  return ok({ estado: cobro.estado, orderId: cobro.order_id });
}

// Si Mercado Pago no confirma la cancelación, el cobro sigue abierto: el cliente todavía puede pagar.
export async function cancelarCobroQr(id: string): Promise<ActionResult<null>> {
  if (!cobroIdSchema.safeParse(id).success) return fail(COBRO_INVALIDO);
  const cobro = await leerCobro(id);
  if (!cobro) return fail(COBRO_INVALIDO);

  if (cobro.order_id) {
    const cancelada = await cancelarOrden(cobro.order_id, id);
    if (!cancelada.ok) return cancelada;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_mp_cobro", { p_cobro_id: id });
  if (error) return fail(ERRORES[error.code] ?? "No se pudo cancelar.");
  return ok(null);
}

export async function confirmarCobroQrManual(
  id: string,
): Promise<ActionResult<{ orderId: string }>> {
  if (!cobroIdSchema.safeParse(id).success) return fail(COBRO_INVALIDO);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirmar_mp_cobro_manual", {
    p_cobro_id: id,
  });
  if (error) return fail(ERRORES[error.code] ?? "No se pudo confirmar.");
  return ok({ orderId: data });
}

async function perfilDueno() {
  const perfil = await getAuthProfile();
  if (!perfil) return fail(SIN_SESION);
  if (perfil.rol !== "dueno") return fail(SOLO_DUENO);
  return ok(perfil);
}

export async function crearPuntoQr(
  input: PuntoQrInput,
): Promise<ActionResult<null>> {
  const parsed = puntoQrSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const perfil = await perfilDueno();
  if (!perfil.ok) return perfil;

  const supabase = await createClient();
  const { error } = await supabase.from("mp_puntos").insert({
    comercio_id: perfil.data.comercio_id,
    nombre: parsed.data.nombre,
    external_pos_id: parsed.data.externalPosId,
  });
  if (error?.code === PG_UNIQUE) {
    return fail("Ya hay un QR con ese nombre o identificador.");
  }
  if (error) return fail("No se pudo guardar el QR.");
  revalidatePath("/config/pagos");
  return ok(null);
}

export async function cambiarActivoPuntoQr(
  id: string,
  activo: boolean,
): Promise<ActionResult<null>> {
  if (!cobroIdSchema.safeParse(id).success) return fail("QR inválido.");
  const perfil = await perfilDueno();
  if (!perfil.ok) return perfil;

  const supabase = await createClient();
  const { error } = await supabase
    .from("mp_puntos")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("No se pudo cambiar el QR.");
  revalidatePath("/config/pagos");
  return ok(null);
}
