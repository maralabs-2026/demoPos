"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile } from "@/modules/auth";
import { promocionSchema, type PromocionInput } from "./schemas";

// Dueño y encargado administran las promos (CLAUDE.md, sección 3). La RLS es la barrera real.
async function requirePromos(): Promise<ActionResult<string>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }
  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");
  if (profile.rol === "cajero") {
    return fail("Tu rol no puede administrar promociones.");
  }
  return ok(profile.comercio_id);
}

export async function crearPromocion(
  input: PromocionInput,
): Promise<ActionResult<null>> {
  const parsed = promocionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Datos de la promo inválidos",
    );
  }
  const comercio = await requirePromos();
  if (!comercio.ok) return comercio;

  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("promociones").insert({
    comercio_id: comercio.data,
    nombre: v.nombre,
    tipo: v.tipo,
    alcance: v.alcance,
    producto_id: v.alcance === "producto" ? v.productoId : null,
    categoria_id: v.alcance === "categoria" ? v.categoriaId : null,
    lleva: v.tipo === "nxm" ? v.lleva : null,
    paga: v.tipo === "nxm" ? v.paga : null,
    cantidad: v.tipo === "precio_cantidad" ? v.cantidad : null,
    precio: v.tipo === "precio_cantidad" ? v.precio : null,
    porcentaje: v.tipo === "porcentaje" ? v.porcentaje : null,
    dias: v.dias,
    desde: v.desde,
    hasta: v.hasta,
  });
  if (error) return fail("No se pudo guardar la promo. Probá de nuevo.");

  revalidatePath("/promociones");
  revalidatePath("/vender");
  return ok(null);
}

export async function cambiarActivaPromocion(
  id: string,
  activa: boolean,
): Promise<ActionResult<null>> {
  const comercio = await requirePromos();
  if (!comercio.ok) return comercio;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promociones")
    .update({ activa })
    .eq("id", id)
    .select("id");
  if (error) return fail("No se pudo cambiar la promo. Probá de nuevo.");
  if (!data || data.length === 0) {
    return fail("La promo ya no existe. Recargá la página.");
  }

  revalidatePath("/promociones");
  revalidatePath("/vender");
  return ok(null);
}
