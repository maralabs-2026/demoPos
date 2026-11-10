import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { movimientosProductoSchema } from "./schemas";

export type TipoMovimiento = "ingreso" | "venta" | "ajuste" | "anulacion";

export type Movimiento = {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string | null;
  usuarioNombre: string | null;
  createdAt: string;
};

// Columnas según los tipos generados. El tipo es text con un check en la base, así que se acota acá.
type MovimientoRow = Pick<
  Tables<"movimientos_stock">,
  "id" | "cantidad" | "motivo" | "created_at"
> & {
  tipo: TipoMovimiento;
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

export type ProductoAContar = {
  id: string;
  nombre: string;
  codigoBarras: string;
};

// Lo que se audita, sin stock: el conteo es a ciegas. categoriaId null: los productos sin categoría.
export async function getProductosAContar(
  categoriaId: string | null,
): Promise<ActionResult<ProductoAContar[]>> {
  const supabase = await createClient();
  const consulta = supabase
    .from("productos")
    .select("id, nombre, codigo_barras")
    // Un servicio (0031) no lleva stock: no se cuenta.
    .eq("controla_stock", true)
    // Un producto desactivado (0042) no se cuenta.
    .eq("activo", true);
  const { data, error } = await (
    categoriaId
      ? consulta.eq("categoria_id", categoriaId)
      : consulta.is("categoria_id", null)
  )
    .order("nombre")
    .overrideTypes<{ id: string; nombre: string; codigo_barras: string }[]>();

  if (error) return fail("No se pudieron leer los productos.");
  return ok(
    data.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      codigoBarras: p.codigo_barras,
    })),
  );
}
