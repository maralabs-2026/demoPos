import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type Proveedor = {
  id: string;
  nombre: string;
  telefono: string | null;
  nota: string | null;
  activo: boolean;
};

// La RLS solo se los muestra a dueño y encargado: para el cajero la lista viene vacía.
export async function getProveedores(): Promise<ActionResult<Proveedor[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre, telefono, nota, activo")
    .order("nombre");
  if (error) return fail("No se pudieron leer los proveedores.");
  return ok(data);
}

export type Compra = {
  id: string;
  fecha: string;
  proveedor: string;
  comprobante: string | null;
  total: number;
  items: {
    nombre: string;
    cantidad: number;
    costoUnitario: number;
    subtotal: number;
  }[];
};

type CompraRow = {
  id: string;
  created_at: string;
  comprobante: string | null;
  total: number;
  proveedores: { nombre: string } | null;
  compra_items: {
    nombre: string;
    cantidad: number;
    costo_unitario: number;
    subtotal: number;
  }[];
};

// Las últimas compras: la RLS solo se las muestra a dueño y encargado.
export async function getCompras(): Promise<ActionResult<Compra[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compras")
    .select(
      "id, created_at, comprobante, total, proveedores(nombre), compra_items(nombre, cantidad, costo_unitario, subtotal)",
    )
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<CompraRow[], { merge: false }>();
  if (error) return fail("No se pudieron leer las compras.");
  return ok(
    data.map((c) => ({
      id: c.id,
      fecha: c.created_at,
      proveedor: c.proveedores?.nombre ?? "Otro proveedor",
      comprobante: c.comprobante,
      total: Number(c.total),
      items: c.compra_items.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        costoUnitario: Number(i.costo_unitario),
        subtotal: Number(i.subtotal),
      })),
    })),
  );
}
