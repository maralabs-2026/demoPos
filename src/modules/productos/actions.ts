"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile, type Rol } from "@/modules/auth";
import { actualizarPreciosSchema, type ActualizarPreciosInput } from "./schemas";

export type PreciosActualizados = { actualizados: number };

// La RLS de productos y la función actualizar_precios son la barrera real; esto solo da un
// mensaje claro antes.
const ROLES_PRECIOS: readonly Rol[] = ["dueno", "encargado"];

// Códigos que puede devolver actualizar_precios (migración 0010).
const PG_INSUFFICIENT_PRIVILEGE = "42501";
const PV_PORCENTAJE_INVALIDO = "PV007";

export async function actualizarPrecios(
  input: ActualizarPreciosInput,
): Promise<ActionResult<PreciosActualizados>> {
  const parsed = actualizarPreciosSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");
  if (!ROLES_PRECIOS.includes(profile.rol)) {
    return fail("Tu rol no puede cambiar precios.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_precios", {
    p_categoria_id: parsed.data.categoriaId,
    p_porcentaje: parsed.data.porcentaje,
  });

  if (error) {
    if (error.code === PG_INSUFFICIENT_PRIVILEGE) return fail("Tu rol no puede cambiar precios.");
    if (error.code === PV_PORCENTAJE_INVALIDO) return fail("El porcentaje no es válido.");
    return fail("No se pudieron actualizar los precios. Probá de nuevo.");
  }

  const actualizados = Number(data ?? 0);
  if (actualizados === 0) {
    return fail("No hay productos en esa categoría.");
  }

  revalidatePath("/productos");
  revalidatePath("/vender");
  return ok({ actualizados });
}
