"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile, type Rol, type SessionProfile } from "@/modules/auth";
import { proveedorSchema, type ProveedorInput } from "./schemas";

const ROLES: readonly Rol[] = ["dueno", "encargado"];
const SIN_PERMISO = "Tu rol no puede administrar proveedores.";
const PG_UNIQUE_VIOLATION = "23505";
const PG_INSUFFICIENT_PRIVILEGE = "42501";

async function requireRol(): Promise<ActionResult<SessionProfile>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }
  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");
  if (!ROLES.includes(profile.rol)) return fail(SIN_PERMISO);
  return ok(profile);
}

function revalidar() {
  revalidatePath("/stock/proveedores");
  revalidatePath("/stock/reposicion");
  revalidatePath("/productos");
}

function errorDeEscritura(code: string | undefined): ActionResult<null> {
  if (code === PG_UNIQUE_VIOLATION) {
    return fail("Ya hay un proveedor con ese nombre.");
  }
  if (code === PG_INSUFFICIENT_PRIVILEGE) return fail(SIN_PERMISO);
  return fail("No se pudo guardar el proveedor. Probá de nuevo.");
}

export async function crearProveedor(
  input: ProveedorInput,
): Promise<ActionResult<null>> {
  const parsed = proveedorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const auth = await requireRol();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedores")
    .insert({ ...parsed.data, comercio_id: auth.data.comercio_id });
  if (error) return errorDeEscritura(error.code);
  revalidar();
  return ok(null);
}

export async function editarProveedor(
  id: string,
  input: ProveedorInput,
): Promise<ActionResult<null>> {
  const parsed = proveedorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!z.uuid().safeParse(id).success) return fail("Datos inválidos");
  const auth = await requireRol();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedores")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return errorDeEscritura(error.code);
  revalidar();
  return ok(null);
}

// Un proveedor no se borra: se desactiva y deja de ofrecerse en los productos.
export async function cambiarActivoProveedor(
  id: string,
  activo: boolean,
): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("Datos inválidos");
  const auth = await requireRol();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedores")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return errorDeEscritura(error.code);
  revalidar();
  return ok(null);
}
