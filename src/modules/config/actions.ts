"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { LOGO_BUCKET, LOGO_TIPOS, tipoDeLogo } from "@/lib/logo";
import { getAuthProfile } from "@/modules/auth";
import {
  comercioNombreSchema,
  corteDiaSchema,
  logoSchema,
  crearCategoriaSchema,
  crearMedioPagoSchema,
  MEDIOS_PAGO_MAX,
  renombrarSchema,
  ticketSchema,
  type ComercioNombreInput,
  type CorteDiaInput,
  type CrearCategoriaInput,
  type CrearMedioPagoInput,
  type RenombrarInput,
  type TicketInput,
} from "./schemas";

const PG_UNIQUE = "23505";
const PG_FOREIGN_KEY = "23503";
const PG_SIN_PERMISO = "42501";
const PV_MEDIO_PROTEGIDO = "PV022";

const SIN_PERMISO = "Solo el dueño puede cambiar la configuración.";
const FALTA_CONFIG = "Falta configurar Supabase en .env.local";

function datosInvalidos(error: { issues: { message: string }[] }) {
  return fail(error.issues[0]?.message ?? "Datos inválidos");
}

// El nombre y el logo se ven en todas las pantallas: se revalida todo el layout.
function revalidarComercio() {
  revalidatePath("/", "layout");
}

async function requireDueno() {
  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");
  if (profile.rol !== "dueno") return fail(SIN_PERMISO);
  return ok(profile);
}

export async function guardarNombreComercio(
  input: ComercioNombreInput,
): Promise<ActionResult<null>> {
  const parsed = comercioNombreSchema.safeParse(input);
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const auth = await requireDueno();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comercios")
    .update({ nombre: parsed.data.nombre })
    .eq("id", auth.data.comercio_id)
    .select("id");
  if (error?.code === PG_SIN_PERMISO || (!error && data.length === 0)) {
    return fail(SIN_PERMISO);
  }
  if (error) return fail("No se pudo guardar el nombre. Probá de nuevo.");

  revalidarComercio();
  return ok(null);
}

// Cada logo tiene un nombre nuevo para que nadie siga viendo el anterior por la caché de la URL.
// Si no se puede borrar el archivo viejo queda sin uso, pero el comercio ya muestra el nuevo.
export async function guardarLogo(
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = logoSchema.safeParse({ logo: formData.get("logo") });
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const bytes = new Uint8Array(await parsed.data.logo.arrayBuffer());
  const ext = tipoDeLogo(bytes);
  if (!ext) return fail("El logo tiene que ser PNG, JPG o WebP.");

  const auth = await requireDueno();
  if (!auth.ok) return auth;
  const comercioId = auth.data.comercio_id;

  const supabase = await createClient();
  const { data: comercio, error: errorComercio } = await supabase
    .from("comercios")
    .select("logo_path")
    .eq("id", comercioId)
    .maybeSingle();
  if (errorComercio || !comercio) {
    return fail("No se pudo guardar el logo. Probá de nuevo.");
  }

  const logos = supabase.storage.from(LOGO_BUCKET);
  const path = `${comercioId}/logo-${Date.now().toString(36)}.${ext}`;
  const { error: errorSubida } = await logos.upload(path, bytes, {
    contentType: LOGO_TIPOS[ext],
    upsert: false,
  });
  if (errorSubida) return fail("No se pudo subir el logo. Probá de nuevo.");

  const { data: actualizados, error } = await supabase
    .from("comercios")
    .update({ logo_path: path })
    .eq("id", comercioId)
    .select("id");
  if (error || actualizados.length === 0) {
    await logos.remove([path]);
    return fail("No se pudo guardar el logo. Probá de nuevo.");
  }

  if (comercio.logo_path) await logos.remove([comercio.logo_path]);
  revalidarComercio();
  return ok(null);
}

export async function quitarLogo(): Promise<ActionResult<null>> {
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const auth = await requireDueno();
  if (!auth.ok) return auth;
  const comercioId = auth.data.comercio_id;

  const supabase = await createClient();
  const { data: comercio, error: errorComercio } = await supabase
    .from("comercios")
    .select("logo_path")
    .eq("id", comercioId)
    .maybeSingle();
  if (errorComercio || !comercio) {
    return fail("No se pudo quitar el logo. Probá de nuevo.");
  }
  if (!comercio.logo_path) return ok(null);

  const { data: actualizados, error } = await supabase
    .from("comercios")
    .update({ logo_path: null })
    .eq("id", comercioId)
    .select("id");
  if (error || actualizados.length === 0) {
    return fail("No se pudo quitar el logo. Probá de nuevo.");
  }

  await supabase.storage.from(LOGO_BUCKET).remove([comercio.logo_path]);
  revalidarComercio();
  return ok(null);
}

// Cambia qué es "hoy" en el inicio y cómo se cortan los días en reportes e historial.
export async function guardarCorteDia(
  input: CorteDiaInput,
): Promise<ActionResult<null>> {
  const parsed = corteDiaSchema.safeParse(input);
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const auth = await requireDueno();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion").upsert(
    {
      comercio_id: auth.data.comercio_id,
      clave: "dia_comercial_corte",
      valor: parsed.data.horas,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "comercio_id,clave" },
  );
  if (error?.code === PG_SIN_PERMISO) return fail(SIN_PERMISO);
  if (error)
    return fail("No se pudo guardar la hora de corte. Probá de nuevo.");

  revalidatePath("/", "layout");
  return ok(null);
}

export async function guardarTicket(
  input: TicketInput,
): Promise<ActionResult<null>> {
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion").upsert(
    {
      comercio_id: profile.comercio_id,
      clave: "ticket",
      valor: parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "comercio_id,clave" },
  );
  if (error?.code === PG_SIN_PERMISO) return fail(SIN_PERMISO);
  if (error) return fail("No se pudo guardar el ticket. Probá de nuevo.");

  revalidatePath("/config/ticket");
  revalidatePath("/vender");
  return ok(null);
}

function revalidarMedios() {
  revalidatePath("/config/pagos");
  revalidatePath("/vender");
  revalidatePath("/caja");
}

export async function crearMedioPago(
  input: CrearMedioPagoInput,
): Promise<ActionResult<null>> {
  const parsed = crearMedioPagoSchema.safeParse(input);
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");

  const supabase = await createClient();
  // Tope de medios: con más, el cierre de caja no los aceptaría a todos.
  const { count } = await supabase
    .from("medios_pago")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MEDIOS_PAGO_MAX) {
    return fail(`Llegaste al máximo de ${MEDIOS_PAGO_MAX} medios de pago.`);
  }

  const { data: ultimo } = await supabase
    .from("medios_pago")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<{ orden: number }>();

  const { error } = await supabase.from("medios_pago").insert({
    comercio_id: profile.comercio_id,
    nombre: parsed.data.nombre,
    tipo: parsed.data.tipo,
    orden: (ultimo?.orden ?? 0) + 1,
  });
  if (error?.code === PG_UNIQUE) return fail("Ya hay un medio con ese nombre.");
  if (error?.code === PG_SIN_PERMISO) return fail(SIN_PERMISO);
  if (error) return fail("No se pudo crear el medio. Probá de nuevo.");

  revalidarMedios();
  return ok(null);
}

// Renombrar no altera ventas ni cierres pasados: guardan el nombre como snapshot.
export async function renombrarMedioPago(
  input: RenombrarInput,
): Promise<ActionResult<null>> {
  const parsed = renombrarSchema.safeParse(input);
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medios_pago")
    .update({ nombre: parsed.data.nombre })
    .eq("id", parsed.data.id)
    .select("id");
  if (error?.code === PG_UNIQUE) return fail("Ya hay un medio con ese nombre.");
  if (error) return fail("No se pudo guardar el medio. Probá de nuevo.");
  // La RLS no da error por las filas que no deja tocar: no las actualiza.
  if (data.length === 0) return fail(SIN_PERMISO);

  revalidarMedios();
  return ok(null);
}

export async function cambiarActivoMedioPago(
  medioId: string,
  activo: boolean,
): Promise<ActionResult<null>> {
  const parsed = renombrarSchema.shape.id.safeParse(medioId);
  if (!parsed.success) return fail("El medio no es válido");
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medios_pago")
    .update({ activo })
    .eq("id", parsed.data)
    .select("id");
  if (error?.code === PV_MEDIO_PROTEGIDO) {
    return fail("Tiene que quedar un medio de efectivo activo.");
  }
  if (error) return fail("No se pudo cambiar el medio. Probá de nuevo.");
  if (data.length === 0) return fail(SIN_PERMISO);

  revalidarMedios();
  return ok(null);
}

function revalidarCategorias() {
  revalidatePath("/config/categorias");
  revalidatePath("/productos");
  revalidatePath("/vender");
  revalidatePath("/stock/auditoria");
}

export async function crearCategoria(
  input: CrearCategoriaInput,
): Promise<ActionResult<null>> {
  const parsed = crearCategoriaSchema.safeParse(input);
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");

  const supabase = await createClient();
  const { data: ultima } = await supabase
    .from("categorias")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<{ orden: number }>();

  const { error } = await supabase.from("categorias").insert({
    comercio_id: profile.comercio_id,
    nombre: parsed.data.nombre,
    orden: (ultima?.orden ?? 0) + 1,
  });
  if (error?.code === PG_UNIQUE) {
    return fail("Ya hay una categoría con ese nombre.");
  }
  if (error?.code === PG_SIN_PERMISO) return fail(SIN_PERMISO);
  if (error) return fail("No se pudo crear la categoría. Probá de nuevo.");

  revalidarCategorias();
  return ok(null);
}

export async function renombrarCategoria(
  input: RenombrarInput,
): Promise<ActionResult<null>> {
  const parsed = renombrarSchema.safeParse(input);
  if (!parsed.success) return datosInvalidos(parsed.error);
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias")
    .update({ nombre: parsed.data.nombre })
    .eq("id", parsed.data.id)
    .select("id");
  if (error?.code === PG_UNIQUE) {
    return fail("Ya hay una categoría con ese nombre.");
  }
  if (error) return fail("No se pudo guardar la categoría. Probá de nuevo.");
  if (data.length === 0) return fail(SIN_PERMISO);

  revalidarCategorias();
  return ok(null);
}

export async function eliminarCategoria(
  categoriaId: string,
): Promise<ActionResult<null>> {
  const parsed = renombrarSchema.shape.id.safeParse(categoriaId);
  if (!parsed.success) return fail("La categoría no es válida");
  if (!isSupabaseConfigured()) return fail(FALTA_CONFIG);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error?.code === PG_FOREIGN_KEY) {
    return fail(
      "Tiene productos o promociones. Cambialos de categoría antes de eliminarla.",
    );
  }
  if (error) return fail("No se pudo eliminar la categoría. Probá de nuevo.");
  if (data.length === 0) return fail(SIN_PERMISO);

  revalidarCategorias();
  return ok(null);
}
