import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import {
  buscarProductosSchema,
  FOTOS_BUCKET,
  type BuscarProductosInput,
} from "./schemas";

export type Producto = {
  id: string;
  nombre: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  codigoBarras: string;
  // null si no se pidió (cajero) o si el producto no tiene costo cargado.
  costo: number | null;
  precio: number;
  stockActual: number;
  stockMinimo: number;
  // false = servicio: no lleva stock (0031).
  controlaStock: boolean;
  unidadVenta: string;
  fotoUrl: string | null;
};

// Columnas de la tabla según los tipos generados. Las relaciones se declaran aparte porque el select
// cambia según el rol (con o sin costos) y la CLI no puede inferirlo.
type ProductoRow = Pick<
  Tables<"productos">,
  | "id"
  | "nombre"
  | "codigo_barras"
  | "precio"
  | "stock_actual"
  | "stock_minimo"
  | "controla_stock"
  | "unidad_venta"
  | "categoria_id"
  | "foto_path"
> & {
  categorias: { nombre: string } | null;
  // PostgREST puede devolver la relación 1 a 1 como objeto o como arreglo.
  productos_costos?: { costo: number } | { costo: number }[] | null;
};

const COLUMNAS =
  "id, nombre, codigo_barras, precio, stock_actual, stock_minimo, controla_stock, unidad_venta, categoria_id, foto_path, categorias(nombre)";

function costoDe(row: ProductoRow): number | null {
  const rel = Array.isArray(row.productos_costos)
    ? row.productos_costos[0]
    : row.productos_costos;
  return rel ? Number(rel.costo) : null;
}

export async function getProductos(
  input?: BuscarProductosInput,
  // Solo para dueño y encargado. La RLS de productos_costos igual se lo oculta al cajero.
  incluirCostos = false,
): Promise<ActionResult<Producto[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const parsed = buscarProductosSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return fail("Búsqueda inválida");
  }

  const supabase = await createClient();
  let query = supabase
    .from("productos")
    .select(incluirCostos ? `${COLUMNAS}, productos_costos(costo)` : COLUMNAS)
    .order("nombre", { ascending: true });

  const term = parsed.data.q;
  if (term) {
    query = query.or(`nombre.ilike.%${term}%,codigo_barras.ilike.%${term}%`);
  }

  const { data, error } = await query.overrideTypes<ProductoRow[]>();
  if (error) return fail(error.message);

  const productos: Producto[] = (data ?? []).map((row) => ({
    id: row.id,
    nombre: row.nombre,
    categoriaId: row.categoria_id,
    categoriaNombre: row.categorias?.nombre ?? null,
    codigoBarras: row.codigo_barras,
    costo: incluirCostos ? costoDe(row) : null,
    precio: Number(row.precio),
    stockActual: row.stock_actual,
    stockMinimo: row.stock_minimo,
    controlaStock: row.controla_stock,
    unidadVenta: row.unidad_venta,
    fotoUrl: row.foto_path
      ? supabase.storage.from(FOTOS_BUCKET).getPublicUrl(row.foto_path).data
          .publicUrl
      : null,
  }));

  return ok(productos);
}

export type Categoria = { id: string; nombre: string };

export async function getCategorias(): Promise<ActionResult<Categoria[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true })
    .overrideTypes<Categoria[]>();
  if (error) return fail(error.message);

  return ok(data ?? []);
}
