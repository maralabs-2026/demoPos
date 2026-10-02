import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  buscarProductosSchema,
  type BuscarProductosInput,
} from "./schemas";

export type Producto = {
  id: string;
  comercioId: string;
  nombre: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  codigoBarras: string;
  costo: number | null;
  precio: number;
  stockActual: number;
  stockMinimo: number;
  unidadVenta: string;
};

type ProductoRow = {
  id: string;
  comercio_id: string;
  nombre: string;
  categoria_id: string | null;
  codigo_barras: string;
  costo?: number;
  precio: number;
  stock_actual: number;
  stock_minimo: number;
  unidad_venta: string;
  categorias: { nombre: string } | null;
};

export async function getProductos(
  input?: BuscarProductosInput,
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
  const columnas = [
    "id",
    "comercio_id",
    "nombre",
    "categoria_id",
    "codigo_barras",
    ...(incluirCostos ? ["costo"] : []),
    "precio",
    "stock_actual",
    "stock_minimo",
    "unidad_venta",
    "categorias(nombre)",
  ].join(", ");

  let query = supabase
    .from("productos")
    .select(columnas)
    .order("nombre", { ascending: true });

  const term = parsed.data.q;

  if (term) {
    query = query.or(`nombre.ilike.%${term}%,codigo_barras.ilike.%${term}%`);
  }

  const { data, error } = await query.overrideTypes<ProductoRow[]>();

  if (error) {
    return fail(error.message);
  }

  const productos: Producto[] = (data ?? []).map((row) => ({
    id: row.id,
    comercioId: row.comercio_id,
    nombre: row.nombre,
    categoriaId: row.categoria_id,
    categoriaNombre: row.categorias?.nombre ?? null,
    codigoBarras: row.codigo_barras,
    costo: incluirCostos ? Number(row.costo) : null,
    precio: Number(row.precio),
    stockActual: row.stock_actual,
    stockMinimo: row.stock_minimo,
    unidadVenta: row.unidad_venta,
  }));

  return ok(productos);
}
