import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type Categoria = {
  id: string;
  nombre: string;
};

type CategoriaRow = {
  id: string;
  nombre: string;
};

export async function getCategorias(): Promise<ActionResult<Categoria[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("orden", { ascending: true })
    .overrideTypes<CategoriaRow[]>();

  if (error) {
    return fail(error.message);
  }

  return ok(data ?? []);
}

