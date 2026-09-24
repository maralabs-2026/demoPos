"use server";

import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { productoSchema, type ProductoInput } from "./schemas";

export async function crearProducto(
  input: ProductoInput,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const parsed = productoSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Datos del producto inválidos");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productos")
    .insert({
      categoria_id: parsed.data.categoriaId,
      nombre: parsed.data.nombre,
      codigo_barras: parsed.data.codigoBarras,
      precio: parsed.data.precio,
      unidad_venta: parsed.data.unidadVenta,
      stock_minimo: parsed.data.stockMinimo,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  return ok({ id: data.id });
}

export async function editarProducto(
  id: string,
  input: ProductoInput,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const parsed = productoSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Datos del producto inválidos");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productos")
    .update({
      categoria_id: parsed.data.categoriaId,
      nombre: parsed.data.nombre,
      codigo_barras: parsed.data.codigoBarras,
      precio: parsed.data.precio,
      unidad_venta: parsed.data.unidadVenta,
      stock_minimo: parsed.data.stockMinimo,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  return ok({ id: data.id });
}

export async function eliminarProducto(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  if (!id) {
    return fail("El producto no es válido");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("id", id);

  if (error) {
    return fail(error.message);
  }

  return ok({ id });
}

