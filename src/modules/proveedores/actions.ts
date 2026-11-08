"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getAuthProfile, type Rol, type SessionProfile } from "@/modules/auth";
import {
  compraSchema,
  proveedorSchema,
  type CompraInput,
  type ProveedorInput,
} from "./schemas";

const ROLES: readonly Rol[] = ["dueno", "encargado"];
const SIN_PERMISO = "Tu rol no puede administrar proveedores.";
const PG_UNIQUE_VIOLATION = "23505";
const PG_INSUFFICIENT_PRIVILEGE = "42501";

async function requireRol(): Promise<ActionResult<SessionProfile>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }
  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");
  if (!ROLES.includes(profile.rol)) return fail(SIN_PERMISO);
  return ok(profile);
}

function revalidar() {
  revalidatePath("/stock/proveedores");
  revalidatePath("/stock/reposicion");
  revalidatePath("/productos");
}

function errorDeEscritura(code: string | undefined): ActionResult<null> {
  if (code === PG_UNIQUE_VIOLATION) {
    return fail("Ya hay un proveedor con ese nombre.");
  }
  if (code === PG_INSUFFICIENT_PRIVILEGE) return fail(SIN_PERMISO);
  return fail("No se pudo guardar el proveedor. Probá de nuevo.");
}

export async function crearProveedor(
  input: ProveedorInput,
): Promise<ActionResult<null>> {
  const parsed = proveedorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const auth = await requireRol();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedores")
    .insert({ ...parsed.data, comercio_id: auth.data.comercio_id });
  if (error) return errorDeEscritura(error.code);
  revalidar();
  return ok(null);
}

export async function editarProveedor(
  id: string,
  input: ProveedorInput,
): Promise<ActionResult<null>> {
  const parsed = proveedorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!z.uuid().safeParse(id).success) return fail("Datos inválidos");
  const auth = await requireRol();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedores")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return errorDeEscritura(error.code);
  revalidar();
  return ok(null);
}

// Un proveedor no se borra: se desactiva y deja de ofrecerse en los productos.
export async function cambiarActivoProveedor(
  id: string,
  activo: boolean,
): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("Datos inválidos");
  const auth = await requireRol();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("proveedores")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return errorDeEscritura(error.code);
  revalidar();
  return ok(null);
}

export type CostoQueSubio = {
  nombre: string;
  precio: number;
  costoAnterior: number;
  costoNuevo: number;
};
export type CompraRegistrada = {
  compraId: string;
  total: number;
  suben: CostoQueSubio[];
};

type CompraRow = {
  compra_id: string;
  total: number;
  suben: {
    nombre: string;
    precio: number;
    costo_anterior: number;
    costo_nuevo: number;
  }[];
};

const ERRORES_COMPRA: Record<string, string> = {
  [PG_INSUFFICIENT_PRIVILEGE]: "Tu rol no puede registrar compras.",
  PV002: "Esa caja no existe o no se puede usar.",
  PV005: "Un producto de la compra ya no existe. Recargá la pantalla.",
  PV012: "Esa caja ya se cerró. Elegí otra forma de pago.",
  PV016: "No se pudo registrar el pago de la compra.",
  PV027: "Un servicio no lleva stock: sacalo de la compra.",
  PV028:
    "Revisá el proveedor, las cantidades y los costos: el total tiene que ser mayor a $ 0.",
};

// Stock, costos, ítems y gasto en una sola transacción (registrar_compra, 0035).
export async function registrarCompra(
  input: CompraInput,
): Promise<ActionResult<CompraRegistrada>> {
  const parsed = compraSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  const auth = await requireRol();
  if (!auth.ok) return auth;

  const { proveedorId, comprobante, items, pago } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_compra", {
    p_proveedor_id: proveedorId,
    p_comprobante: comprobante,
    p_items: items.map((i) => ({
      producto_id: i.productoId,
      cantidad: i.cantidad,
      costo_lista: i.costoLista,
      bonificacion_pct: i.bonificacionPct,
      vencimiento: i.vencimiento,
    })),
    p_pago: pago.tipo,
    p_caja_id: pago.tipo === "caja" ? pago.cajaId : undefined,
    p_vencimiento:
      pago.tipo === "por_pagar" ? (pago.vencimiento ?? undefined) : undefined,
  });
  if (error) {
    return fail(
      ERRORES_COMPRA[error.code] ??
        "No se pudo registrar la compra. Probá de nuevo.",
    );
  }

  const r = data as CompraRow;
  revalidatePath("/stock/compras");
  revalidatePath("/stock");
  revalidatePath("/productos");
  revalidatePath("/vender");
  revalidatePath("/caja");
  revalidatePath("/caja/gastos");
  revalidatePath("/inicio");
  return ok({
    compraId: r.compra_id,
    total: Number(r.total),
    suben: r.suben.map((c) => ({
      nombre: c.nombre,
      precio: Number(c.precio),
      costoAnterior: Number(c.costo_anterior),
      costoNuevo: Number(c.costo_nuevo),
    })),
  });
}
