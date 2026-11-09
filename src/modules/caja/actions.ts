"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile } from "@/modules/auth";
import { getCajaAbierta, type CajaAbierta } from "./queries";
import {
  abrirCajaSchema,
  cerrarCajaSchema,
  generarCodigoAjusteSchema,
  pagarGastoSchema,
  registrarAjusteSchema,
  registrarGastoSchema,
  registrarMovimientoSchema,
  type AbrirCajaInput,
  type CerrarCajaInput,
  type GenerarCodigoAjusteInput,
  type PagarGastoInput,
  type RegistrarAjusteInput,
  type RegistrarGastoInput,
  type RegistrarMovimientoInput,
} from "./schemas";

const PG_UNIQUE_VIOLATION = "23505"; // cajas_una_abierta_por_usuario_idx
const PV_CAJA_INVALIDA = "PV002";
const PV_CAJA_CERRADA = "PV012";
const PV_CONTEO_INVALIDO = "PV014";
const PV_MOVIMIENTO_INVALIDO = "PV015";
const PV_GASTO_INVALIDO = "PV016";
const PV_GASTO_YA_RESUELTO = "PV017";
const PV_SIN_CODIGO = "PV019";
const PV_MONTO_NO_AUTORIZADO = "PV020";
const PG_SIN_PERMISO = "42501";

function errorDeGasto(code: string | undefined, porDefecto: string): string {
  switch (code) {
    case PG_SIN_PERMISO:
      return "No tenés permiso para operar gastos.";
    case PV_CAJA_INVALIDA:
      return "Esa caja no existe o no podés operar sobre ella.";
    case PV_CAJA_CERRADA:
      return "Esa caja ya se cerró. Elegí otra forma de pago.";
    case PV_GASTO_INVALIDO:
      return "El gasto no es válido. Revisá los datos.";
    case PV_GASTO_YA_RESUELTO:
      return "Este gasto ya está pagado o anulado.";
    default:
      return porDefecto;
  }
}

function revalidarGastos(cajaId: string | null) {
  revalidatePath("/caja/gastos");
  if (cajaId) {
    revalidatePath("/caja");
    revalidatePath(`/caja/cerrar/${cajaId}`);
  }
}

// Carga un gasto. Si se pagó con una caja, la base genera el retiro en la misma transacción.
export async function registrarGasto(
  input: RegistrarGastoInput,
): Promise<ActionResult<null>> {
  const parsed = registrarGastoSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_gasto", {
    p_descripcion: parsed.data.descripcion,
    p_tipo: parsed.data.tipo,
    p_monto: parsed.data.monto,
    p_vencimiento: parsed.data.vencimiento,
    p_pagado: parsed.data.pagado,
    p_caja_id: parsed.data.cajaId,
  });
  if (error) {
    return fail(
      errorDeGasto(error.code, "No se pudo cargar el gasto. Probá de nuevo."),
    );
  }

  revalidarGastos(parsed.data.cajaId);
  return ok(null);
}

export async function pagarGasto(
  input: PagarGastoInput,
): Promise<ActionResult<null>> {
  const parsed = pagarGastoSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("pagar_gasto", {
    p_gasto_id: parsed.data.gastoId,
    p_caja_id: parsed.data.cajaId,
  });
  if (error) {
    return fail(
      errorDeGasto(error.code, "No se pudo pagar el gasto. Probá de nuevo."),
    );
  }

  revalidarGastos(parsed.data.cajaId);
  return ok(null);
}

// Anula el gasto. devuelto indica si la plata volvió a su caja, que seguía abierta.
export async function anularGasto(
  gastoId: string,
): Promise<ActionResult<{ devuelto: boolean }>> {
  const parsed = pagarGastoSchema.shape.gastoId.safeParse(gastoId);
  if (!parsed.success) return fail("El gasto no es válido");
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("anular_gasto", {
    p_gasto_id: parsed.data,
  });
  if (error) {
    return fail(
      errorDeGasto(error.code, "No se pudo anular el gasto. Probá de nuevo."),
    );
  }

  revalidatePath("/caja/gastos");
  revalidatePath("/caja");
  return ok({ devuelto: data === true });
}

function errorDeMovimiento(code: string | undefined): string {
  switch (code) {
    case PG_SIN_PERMISO:
      return "No tenés permiso para hacer esto.";
    case PV_CAJA_INVALIDA:
      return "Esta caja no existe o no podés operar sobre ella.";
    case PV_CAJA_CERRADA:
      return "Esta caja ya está cerrada.";
    case PV_MOVIMIENTO_INVALIDO:
      return "El movimiento no es válido. Revisá el monto y el motivo.";
    case PV_SIN_CODIGO:
      return "No hay un código vigente para esta caja. Pedile uno nuevo al dueño.";
    case PV_MONTO_NO_AUTORIZADO:
      return "El monto supera lo que autorizó el dueño.";
    default:
      return "No se pudo registrar el movimiento. Probá de nuevo.";
  }
}

function revalidarCaja(cajaId: string) {
  revalidatePath("/caja");
  revalidatePath(`/caja/cerrar/${cajaId}`);
}

// Retiro o ingreso de efectivo durante el turno. Entra en el esperado del cierre.
export async function registrarMovimiento(
  input: RegistrarMovimientoInput,
): Promise<ActionResult<null>> {
  const parsed = registrarMovimientoSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_movimiento_caja", {
    p_caja_id: parsed.data.cajaId,
    p_tipo: parsed.data.tipo,
    p_monto: parsed.data.monto,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fail(errorDeMovimiento(error.code));

  revalidarCaja(parsed.data.cajaId);
  return ok(null);
}

// Un retiro o ingreso marcado como ajuste. El dueño lo carga sin código; encargado y cajero, con
// el código que les pasó el dueño. Los permisos y el código los controla la base.
export async function registrarAjusteCaja(
  input: RegistrarAjusteInput,
): Promise<ActionResult<null>> {
  const parsed = registrarAjusteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_ajuste_caja", {
    p_caja_id: parsed.data.cajaId,
    p_tipo: parsed.data.tipo,
    p_monto: parsed.data.monto,
    p_motivo: parsed.data.motivo,
    p_codigo: parsed.data.codigo ?? undefined,
  });
  if (error) return fail(errorDeMovimiento(error.code));
  // Sin error y sin id: el código no era correcto (la base guarda el intento).
  if (!data) {
    return fail(
      "El código no es correcto. Revisalo con el dueño: con 5 errores deja de servir.",
    );
  }

  revalidarCaja(parsed.data.cajaId);
  return ok(null);
}

// Solo el dueño: un código de 6 números para que otro cargue un ajuste en esta caja. Se muestra
// una sola vez; en la base queda cifrado.
export async function generarCodigoAjuste(
  input: GenerarCodigoAjusteInput,
): Promise<ActionResult<{ codigo: string; venceAt: string }>> {
  const parsed = generarCodigoAjusteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_codigo_ajuste", {
    p_caja_id: parsed.data.cajaId,
    p_monto_max: parsed.data.montoMax,
  });
  const generado = data?.[0];
  if (error || !generado) {
    return fail(
      error?.code === PG_SIN_PERMISO
        ? "Solo el dueño genera códigos de ajuste."
        : error
          ? errorDeMovimiento(error.code)
          : "No se pudo generar el código. Probá de nuevo.",
    );
  }
  return ok({ codigo: generado.codigo, venceAt: generado.vence_at });
}

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
