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
