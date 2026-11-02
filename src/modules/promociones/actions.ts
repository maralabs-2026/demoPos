"use server";

import { revalidatePath } from "next/cache";
import { formatCurrency } from "@/lib/currency";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile } from "@/modules/auth";
import {
  comboSchema,
  promocionSchema,
  type ComboInput,
  type PromocionInput,
} from "./schemas";

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

// Alta atómica del combo y sus productos (crear_combo, migración 0014).
export async function crearCombo(input: ComboInput): Promise<ActionResult<null>> {
  const parsed = comboSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos del combo inválidos");
  }
  const comercio = await requirePromos();
  if (!comercio.ok) return comercio;

  const v = parsed.data;
  const supabase = await createClient();

  // Un combo que no es más barato que sus productos nunca se aplicaría: mejor avisar al crearlo.
  const { data: productos, error: errorProductos } = await supabase
    .from("productos")
    .select("id, precio")
    .in(
      "id",
      v.items.map((i) => i.productoId),
    )
    .overrideTypes<{ id: string; precio: number }[]>();
  if (errorProductos || !productos || productos.length !== v.items.length) {
    return fail("Un producto del combo ya no existe. Recargá la página.");
  }
  const sumaC = v.items.reduce((acc, item) => {
    const precio = productos.find((p) => p.id === item.productoId)?.precio ?? 0;
    return acc + Math.round(Number(precio) * 100) * item.cantidad;
  }, 0);
  if (Math.round(v.precio * 100) >= sumaC) {
    return fail(
      `El precio del combo tiene que ser menor que la suma de sus productos (${formatCurrency(sumaC / 100)}).`,
    );
  }

  const { error } = await supabase.rpc("crear_combo", {
    p_nombre: v.nombre,
    p_precio: v.precio,
    p_dias: v.dias,
    p_desde: v.desde,
    // El formulario llega hasta el minuto: "23:59" es hasta el final del día.
    p_hasta: v.hasta === "23:59" ? "23:59:59" : v.hasta,
    p_items: v.items.map((i) => ({
      producto_id: i.productoId,
      cantidad: i.cantidad,
    })),
  });
  if (error) {
    return fail(
      error.code === "23505"
        ? "Un producto aparece dos veces en el combo."
        : "No se pudo guardar el combo. Probá de nuevo.",
    );
  }

  revalidatePath("/promociones");
  revalidatePath("/vender");
  return ok(null);
}

export async function cambiarActivaCombo(
  id: string,
  activa: boolean,
): Promise<ActionResult<null>> {
  const comercio = await requirePromos();
  if (!comercio.ok) return comercio;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("combos")
    .update({ activa })
    .eq("id", id)
    .select("id");
  if (error) return fail("No se pudo cambiar el combo. Probá de nuevo.");
  if (!data || data.length === 0) {
    return fail("El combo ya no existe. Recargá la página.");
  }

  revalidatePath("/promociones");
  revalidatePath("/vender");
  return ok(null);
}

// Borra el combo y sus productos (en cascada). Las ventas guardan su propio snapshot.
export async function eliminarCombo(id: string): Promise<ActionResult<null>> {
  const comercio = await requirePromos();
  if (!comercio.ok) return comercio;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("combos")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return fail("No se pudo eliminar el combo. Probá de nuevo.");
  if (!data || data.length === 0) {
    return fail("El combo ya no existe. Recargá la página.");
  }

  revalidatePath("/promociones");
  revalidatePath("/vender");
  return ok(null);
}
