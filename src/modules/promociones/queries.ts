import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Promo, TipoPromo } from "./logica";

type PromoRow = {
  id: string;
  nombre: string;
  tipo: TipoPromo;
  alcance: "producto" | "categoria";
  producto_id: string | null;
  categoria_id: string | null;
  lleva: number | null;
  paga: number | null;
  cantidad: number | null;
  precio: number | null;
  porcentaje: number | null;
  dias: number[];
  desde: string;
  hasta: string;
  activa: boolean;
};

const COLUMNAS =
  "id, nombre, tipo, alcance, producto_id, categoria_id, lleva, paga, cantidad, precio, porcentaje, dias, desde, hasta, activa";

// Todas las promos del comercio (RLS). El ticket filtra por vigencia con la hora actual.
export async function getPromociones(): Promise<ActionResult<Promo[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promociones")
    .select(COLUMNAS)
    .order("created_at", { ascending: true })
    .overrideTypes<PromoRow[]>();
  if (error) return fail("No se pudieron cargar las promociones.");

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      tipo: r.tipo,
      alcance: r.alcance,
      productoId: r.producto_id,
      categoriaId: r.categoria_id,
      lleva: r.lleva,
      paga: r.paga,
      cantidad: r.cantidad,
      precio: r.precio === null ? null : Number(r.precio),
      porcentaje: r.porcentaje === null ? null : Number(r.porcentaje),
      dias: r.dias as number[],
      desde: r.desde,
      hasta: r.hasta,
      activa: r.activa,
    })),
  );
}
