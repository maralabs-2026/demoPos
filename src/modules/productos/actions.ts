"use server";

import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getPerfilActual } from "@/modules/auth";
import { productoSchema, type ProductoInput } from "./schemas";

async function getPerfilGestor(comercioId: string) {
  const perfil = await getPerfilActual();

  if (!perfil) {
    return {
      ok: false as const,
      error: "Necesitás iniciar sesión para gestionar productos",
    };
  }

  if (perfil.rol === "cajero") {
    return {
      ok: false as const,
      error: "No tenés permisos para gestionar productos",
    };
  }

  if (perfil.comercioId !== comercioId) {
    return {
      ok: false as const,
      error: "No podés modificar productos de otro comercio",
    };
  }

  return { ok: true as const, perfil };
}

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

  const authorization = await getPerfilGestor(parsed.data.comercioId);
  if (!authorization.ok) {
    return fail(authorization.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productos")
    .insert({
      comercio_id: authorization.perfil.comercioId,
      categoria_id: parsed.data.categoriaId,
      nombre: parsed.data.nombre,
      codigo_barras: parsed.data.codigoBarras,
      costo: parsed.data.costo,
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

  const authorization = await getPerfilGestor(parsed.data.comercioId);
  if (!authorization.ok) {
    return fail(authorization.error);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productos")
    .update({
      categoria_id: parsed.data.categoriaId,
      nombre: parsed.data.nombre,
      codigo_barras: parsed.data.codigoBarras,
      costo: parsed.data.costo,
      precio: parsed.data.precio,
      unidad_venta: parsed.data.unidadVenta,
      stock_minimo: parsed.data.stockMinimo,
    })
    .eq("id", id)
    .eq("comercio_id", authorization.perfil.comercioId)
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

  const perfil = await getPerfilActual();
  if (!perfil) {
    return fail("Necesitás iniciar sesión para gestionar productos");
  }
  if (perfil.rol === "cajero") {
    return fail("No tenés permisos para gestionar productos");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("id", id)
    .eq("comercio_id", perfil.comercioId);

  if (error) {
    return fail(error.message);
  }

  return ok({ id });
}