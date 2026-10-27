"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile, type Rol, type SessionProfile } from "@/modules/auth";
import {
  actualizarPreciosSchema,
  productoSchema,
  validarCsvProductos,
  valoresAnterioresSchema,
  type ActualizarPreciosInput,
  type ProductoInput,
  type ValoresAnteriores,
} from "./schemas";

export type PreciosActualizados = { actualizados: number };
export type ProductoGuardado = { id: string };
export type ProductosImportados = { creados: number; actualizados: number };

// La RLS de productos y las funciones SQL son la barrera real; esto solo da un mensaje claro antes.
const ROLES_CATALOGO: readonly Rol[] = ["dueno", "encargado"];

// Códigos que pueden devolver actualizar_precios (0009), guardar_producto (0010) y el delete.
const PG_INSUFFICIENT_PRIVILEGE = "42501";
const PG_NUMERIC_OVERFLOW = "22003"; // un precio quedaría fuera de numeric(12,2)
const PG_UNIQUE_VIOLATION = "23505"; // (comercio_id, codigo_barras)
const PG_FOREIGN_KEY_VIOLATION = "23503"; // el producto ya tiene ventas o movimientos
const PV_PRODUCTO_INEXISTENTE = "PV005";
const PV_PORCENTAJE_INVALIDO = "PV007";
const PV_CATEGORIA_INVALIDA = "PV008";
const PV_CAMBIO_CONCURRENTE = "PV009";
const PV_IMPORTACION_INVALIDA = "PV010";

async function requireRolCatalogo(
  mensaje: string,
): Promise<ActionResult<SessionProfile>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }
  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");
  if (!ROLES_CATALOGO.includes(profile.rol)) return fail(mensaje);
  return ok(profile);
}

function revalidarCatalogo() {
  revalidatePath("/productos");
  revalidatePath("/vender");
}

export async function actualizarPrecios(
  input: ActualizarPreciosInput,
): Promise<ActionResult<PreciosActualizados>> {
  const parsed = actualizarPreciosSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const auth = await requireRolCatalogo("Tu rol no puede cambiar precios.");
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_precios", {
    p_categoria_id: parsed.data.categoriaId,
    p_porcentaje: parsed.data.porcentaje,
  });

  if (error) {
    if (error.code === PG_INSUFFICIENT_PRIVILEGE)
      return fail("Tu rol no puede cambiar precios.");
    if (error.code === PV_PORCENTAJE_INVALIDO)
      return fail("El porcentaje no es válido.");
    if (error.code === PG_NUMERIC_OVERFLOW) {
      return fail(
        "Con ese porcentaje algún precio queda demasiado alto. Probá con uno menor.",
      );
    }
    return fail("No se pudieron actualizar los precios. Probá de nuevo.");
  }

  const actualizados = Number(data ?? 0);
  if (actualizados === 0) {
    return fail(
      parsed.data.categoriaId === null
        ? "No hay productos en el catálogo."
        : "No hay productos en esa categoría.",
    );
  }

  revalidarCatalogo();
  return ok({ actualizados });
}

async function guardarProducto(
  id: string | null,
  input: ProductoInput,
  anterior: ValoresAnteriores | null,
): Promise<ActionResult<ProductoGuardado>> {
  const parsed = productoSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Datos del producto inválidos",
    );
  }

  const auth = await requireRolCatalogo("Tu rol no puede gestionar productos.");
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guardar_producto", {
    p_id: id,
    p_categoria_id: parsed.data.categoriaId,
    p_nombre: parsed.data.nombre,
    p_codigo_barras: parsed.data.codigoBarras,
    p_precio: parsed.data.precio,
    p_unidad_venta: parsed.data.unidadVenta,
    p_stock_minimo: parsed.data.stockMinimo,
    p_costo: parsed.data.costo,
    p_precio_anterior: anterior?.precio ?? null,
    p_costo_anterior: anterior?.costo ?? null,
  });

  if (error) {
    switch (error.code) {
      case PG_UNIQUE_VIOLATION:
        return fail("Ya hay un producto con ese código de barras.");
      case PG_INSUFFICIENT_PRIVILEGE:
        return fail("Tu rol no puede gestionar productos.");
      case PV_CATEGORIA_INVALIDA:
        return fail("La categoría no existe. Recargá la página.");
      case PV_PRODUCTO_INEXISTENTE:
        return fail("El producto ya no existe. Recargá la página.");
      case PV_CAMBIO_CONCURRENTE:
        return fail(
          "Otro usuario cambió el precio o el costo mientras editabas. Cerrá el formulario y volvé a abrirlo.",
        );
      default:
        return fail("No se pudo guardar el producto. Probá de nuevo.");
    }
  }

  revalidarCatalogo();
  return ok({ id: String(data) });
}

export async function crearProducto(
  input: ProductoInput,
): Promise<ActionResult<ProductoGuardado>> {
  return guardarProducto(null, input, null);
}

// `anterior` son el precio y el costo que se vieron al abrir el formulario: si cambiaron en la
// base mientras tanto, se rechaza en vez de pisarlos.
export async function editarProducto(
  id: string,
  input: ProductoInput,
  anterior: ValoresAnteriores,
): Promise<ActionResult<ProductoGuardado>> {
  if (!id) return fail("El producto no es válido");
  const parsedAnterior = valoresAnterioresSchema.safeParse(anterior);
  if (!parsedAnterior.success)
    return fail("Recargá la página y volvé a editar el producto.");
  return guardarProducto(id, input, parsedAnterior.data);
}

export async function eliminarProducto(
  id: string,
): Promise<ActionResult<ProductoGuardado>> {
  if (!id) return fail("El producto no es válido");

  const auth = await requireRolCatalogo("Tu rol no puede gestionar productos.");
  if (!auth.ok) return auth;

  const supabase = await createClient();
  // El costo se borra en cascada. La RLS filtra en silencio, por eso se pide la fila borrada.
  const { data, error } = await supabase
    .from("productos")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === PG_FOREIGN_KEY_VIOLATION) {
      return fail(
        "No se puede eliminar: el producto ya tiene ventas o movimientos de stock.",
      );
    }
    return fail("No se pudo eliminar el producto. Probá de nuevo.");
  }
  if (!data || data.length === 0) {
    return fail("El producto ya no existe. Recargá la página.");
  }

  revalidarCatalogo();
  return ok({ id });
}

// Recibe las filas del CSV tal como se leyeron (texto) y las vuelve a validar acá: la vista
// previa del cliente no es una barrera. Si alguna fila tiene errores no se importa nada.
export async function importarProductos(
  filas: Record<string, string>[],
  encabezados: string[],
): Promise<ActionResult<ProductosImportados>> {
  if (!Array.isArray(filas) || !Array.isArray(encabezados)) {
    return fail("El archivo no es válido. Volvé a elegirlo.");
  }
  const validado = validarCsvProductos(filas, encabezados);
  if (!validado.ok) return fail(validado.error);

  const productos = [];
  for (const fila of validado.filas) {
    if (!fila.ok) {
      return fail(
        `La fila ${fila.numero} tiene errores: ${fila.errores.join("; ")}`,
      );
    }
    productos.push({
      nombre: fila.producto.nombre,
      codigo_barras: fila.producto.codigoBarras,
      categoria: fila.producto.categoria,
      precio: fila.producto.precio,
      costo: fila.producto.costo,
      unidad_venta: fila.producto.unidadVenta,
      stock_minimo: fila.producto.stockMinimo,
    });
  }

  const auth = await requireRolCatalogo("Tu rol no puede importar productos.");
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("importar_productos", {
    p_productos: productos,
  });

  if (error) {
    // DETAIL trae el número de producto (desde 1); en la planilla la fila 1 son los encabezados.
    const producto = /^\d+$/.test(error.details ?? "")
      ? Number(error.details)
      : 0;
    const enFila = producto > 0 ? ` (fila ${producto + 1})` : "";
    switch (error.code) {
      case PG_INSUFFICIENT_PRIVILEGE:
        return fail("Tu rol no puede importar productos.");
      case PV_CATEGORIA_INVALIDA:
        return fail(
          `Una categoría del archivo no existe${enFila}. Recargá la página y revisá la vista previa.`,
        );
      case PV_IMPORTACION_INVALIDA:
        return fail(`Hay datos inválidos en el archivo${enFila}.`);
      case PG_NUMERIC_OVERFLOW:
        return fail(`Hay un monto demasiado alto en el archivo${enFila}.`);
      default:
        return fail("No se pudieron importar los productos. Probá de nuevo.");
    }
  }

  const resultado = data as Partial<ProductosImportados> | null;
  revalidarCatalogo();
  return ok({
    creados: Number(resultado?.creados ?? 0),
    actualizados: Number(resultado?.actualizados ?? 0),
  });
}
