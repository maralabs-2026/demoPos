"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile, type Rol } from "@/modules/auth";
import {
  ajusteSchema,
  auditoriaSchema,
  cantidadConSigno,
  ingresoSchema,
  type AjusteInput,
  type AuditoriaInput,
  type IngresoInput,
} from "./schemas";

export type MovimientoRegistrado = { stockActual: number };

// La RLS de movimientos_stock es la barrera real; esto solo da un mensaje claro antes.
const ROLES_STOCK: readonly Rol[] = ["dueno", "encargado"];

// Códigos de Postgres que puede devolver el insert.
const PG_CHECK_VIOLATION = "23514"; // productos.stock_actual >= 0
const PG_INSUFFICIENT_PRIVILEGE = "42501"; // RLS

type NuevoMovimiento = {
  productoId: string;
  tipo: "ingreso" | "ajuste";
  cantidad: number;
  motivo: string | undefined;
  vencimiento?: string;
};

async function insertarMovimiento(
  mov: NuevoMovimiento,
): Promise<ActionResult<MovimientoRegistrado>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");
  if (!ROLES_STOCK.includes(profile.rol)) {
    return fail("Tu rol no puede modificar el stock.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Volvé a ingresar.");

  const { data: producto, error: productoError } = await supabase
    .from("productos")
    .select("stock_actual")
    .eq("id", mov.productoId)
    .maybeSingle()
    .overrideTypes<{ stock_actual: number }>();
  if (productoError)
    return fail("No se pudo leer el producto. Probá de nuevo.");
  if (!producto) return fail("El producto no existe.");

  if (producto.stock_actual + mov.cantidad < 0) {
    return fail(
      `No podés restar más de lo que hay (quedan ${producto.stock_actual}).`,
    );
  }

  const { error } = await supabase.from("movimientos_stock").insert({
    comercio_id: profile.comercio_id,
    producto_id: mov.productoId,
    tipo: mov.tipo,
    cantidad: mov.cantidad,
    motivo: mov.motivo ?? null,
    usuario_id: user.id,
    vencimiento: mov.vencimiento ?? null,
  });
  if (error) {
    // Otra venta o ajuste pudo bajar el stock entre la lectura y el insert.
    if (error.code === PG_CHECK_VIOLATION) {
      return fail(
        "El stock cambió mientras cargabas. Revisalo y probá de nuevo.",
      );
    }
    if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
      return fail("Tu rol no puede modificar el stock.");
    }
    return fail("No se pudo registrar el movimiento. Probá de nuevo.");
  }

  // stock_actual lo actualiza el trigger; se relee para mostrar el valor real.
  const { data: actualizado } = await supabase
    .from("productos")
    .select("stock_actual")
    .eq("id", mov.productoId)
    .maybeSingle()
    .overrideTypes<{ stock_actual: number }>();

  revalidatePath("/stock");
  revalidatePath("/productos");
  return ok({
    stockActual:
      actualizado?.stock_actual ?? producto.stock_actual + mov.cantidad,
  });
}

export async function registrarIngreso(
  input: IngresoInput,
): Promise<ActionResult<MovimientoRegistrado>> {
  const parsed = ingresoSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Datos de ingreso inválidos",
    );
  }
  return insertarMovimiento({ ...parsed.data, tipo: "ingreso" });
}

export async function registrarAjuste(
  input: AjusteInput,
): Promise<ActionResult<MovimientoRegistrado>> {
  const parsed = ajusteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos de ajuste inválidos");
  }
  return insertarMovimiento({
    productoId: parsed.data.productoId,
    tipo: "ajuste",
    cantidad: cantidadConSigno(parsed.data),
    motivo: parsed.data.motivo,
  });
}

export type LineaAuditoria = {
  productoId: string;
  nombre: string;
  sistema: number;
  contado: number;
  diferencia: number;
};

type AuditoriaRow = {
  motivo: string;
  lineas: {
    producto_id: string;
    nombre: string;
    sistema: number;
    contado: number;
    diferencia: number;
  }[];
};

// Aplica el conteo en una transacción: un ajuste con motivo por cada producto con diferencia.
export async function aplicarAuditoria(
  input: AuditoriaInput,
): Promise<ActionResult<{ motivo: string; lineas: LineaAuditoria[] }>> {
  const parsed = auditoriaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aplicar_auditoria_stock", {
    p_categoria_id: parsed.data.categoriaId,
    p_conteos: parsed.data.conteos.map((c) => ({
      producto_id: c.productoId,
      contado: c.contado,
    })),
  });

  if (error) {
    if (error.code === "42501") {
      return fail("No tenés permiso para auditar el stock.");
    }
    if (error.code === "PV021") {
      return fail(
        "El conteo no es válido. Recargá la página y probá de nuevo.",
      );
    }
    return fail("No se pudo aplicar la auditoría. Probá de nuevo.");
  }

  revalidatePath("/stock");
  revalidatePath("/stock/reposicion");
  revalidatePath("/productos");
  revalidatePath("/vender");
  revalidatePath("/inicio");

  const resultado = data as AuditoriaRow;
  return ok({
    motivo: resultado.motivo,
    lineas: resultado.lineas.map((l) => ({
      productoId: l.producto_id,
      nombre: l.nombre,
      sistema: l.sistema,
      contado: l.contado,
      diferencia: l.diferencia,
    })),
  });
}
