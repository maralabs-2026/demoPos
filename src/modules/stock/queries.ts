import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { movimientosProductoSchema } from "./schemas";

export type TipoMovimiento = "ingreso" | "venta" | "ajuste";

export type Movimiento = {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string | null;
  usuarioNombre: string | null;
  createdAt: string;
};

// TODO(demo): tipos escritos a mano porque todavía no se corrió `supabase gen types`.
type MovimientoRow = {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string | null;
  created_at: string;
  perfiles: { nombre: string } | null;
};

const LIMITE_HISTORIAL = 20;

// Últimos movimientos de un producto. La RLS solo deja leer a dueño y encargado.
export async function getMovimientos(
  productoId: string,
): Promise<ActionResult<Movimiento[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const parsed = movimientosProductoSchema.safeParse({ productoId });
  if (!parsed.success) return fail("Producto inválido");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movimientos_stock")
    .select("id, tipo, cantidad, motivo, created_at, perfiles(nombre)")
    .eq("producto_id", parsed.data.productoId)
    .order("created_at", { ascending: false })
    .limit(LIMITE_HISTORIAL)
    .overrideTypes<MovimientoRow[]>();
  if (error) return fail("No se pudo cargar el historial de stock");

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      tipo: row.tipo,
      cantidad: row.cantidad,
      motivo: row.motivo,
      usuarioNombre: row.perfiles?.nombre ?? null,
      createdAt: row.created_at,
    })),
  );
}
