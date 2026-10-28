"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { registrarVentaSchema, type RegistrarVentaInput } from "./schemas";

export type ComprobanteItem = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type Comprobante = {
  ventaId: string;
  items: ComprobanteItem[];
  total: number;
  medioPagoNombre: string;
  vuelto: number | null;
  fecha: string;
};

// Códigos de registrar_venta (0007) y de Postgres.
const PG_NOT_AUTHENTICATED = "28000";
const PG_INSUFFICIENT_PRIVILEGE = "42501";
const PV_STOCK_INSUFICIENTE = "PV001";
const PV_CAJA_INVALIDA = "PV002";
const PV_PAGO_INVALIDO = "PV003";
const PV_DATOS_INVALIDOS = "PV004";
const PV_PRODUCTO_INEXISTENTE = "PV005";

type RpcResult = {
  venta_id: string;
  total: number;
  vuelto: number;
  created_at: string;
};

type ItemRow = {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

type PagoRow = { medios_pago: { nombre: string; tipo: string } | null };

async function mensajeSinStock(productoId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("productos")
    .select("nombre, stock_actual")
    .eq("id", productoId)
    .maybeSingle()
    .overrideTypes<{ nombre: string; stock_actual: number }>();
  if (!data)
    return "Un producto del ticket se quedó sin stock. Revisá el ticket.";
  return data.stock_actual > 0
    ? `Solo quedan ${data.stock_actual} de "${data.nombre}". Ajustá la cantidad.`
    : `"${data.nombre}" se quedó sin stock. Quitalo del ticket.`;
}

// Cierra la venta con registrar_venta: cabecera, ítems, pagos y movimientos de stock en una
// sola transacción (sección 3 de CLAUDE.md). Precios y total salen de la base, nunca del cliente.
export async function registrarVenta(
  input: RegistrarVentaInput,
): Promise<ActionResult<Comprobante>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const parsed = registrarVentaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos de venta inválidos");
  }
  const { cajaId, items, pagos } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_venta", {
    p_caja_id: cajaId,
    p_items: items.map((i) => ({
      producto_id: i.productoId,
      cantidad: i.cantidad,
    })),
    p_pagos: pagos.map((p) => ({
      medio_pago_id: p.medioPagoId,
      monto: p.monto,
      ...(p.recibido !== undefined ? { recibido: p.recibido } : {}),
    })),
  });

  if (error) {
    switch (error.code) {
      case PG_NOT_AUTHENTICATED:
        return fail("Tu sesión venció. Volvé a ingresar.");
      case PG_INSUFFICIENT_PRIVILEGE:
        return fail("Tu usuario no puede registrar ventas.");
      case PV_STOCK_INSUFICIENTE:
        return fail(await mensajeSinStock(error.details ?? ""));
      case PV_CAJA_INVALIDA:
        return fail("Tu caja está cerrada. Abrila de nuevo para cobrar.");
      case PV_PAGO_INVALIDO:
        if (error.message.includes("recibido")) {
          return fail("El monto recibido es menor al total.");
        }
        if (error.message.includes("no coinciden")) {
          return fail(
            "El total cambió porque se actualizó algún precio. Recargá la pantalla y cobrá de nuevo.",
          );
        }
        return fail("Elegí un medio de pago válido.");
      case PV_PRODUCTO_INEXISTENTE:
        return fail(
          "Un producto del ticket ya no existe. Recargá la pantalla.",
        );
      case PV_DATOS_INVALIDOS:
        return fail("Revisá el ticket: hay cantidades o montos inválidos.");
      default:
        return fail("No se pudo registrar la venta. Probá de nuevo.");
    }
  }

  const venta = data as RpcResult;

  // El comprobante sale de lo que guardó la venta (snapshot), no de lo que tenía la pantalla.
  const [itemsResult, pagosResult] = await Promise.all([
    supabase
      .from("venta_items")
      .select("nombre, cantidad, precio_unitario, subtotal")
      .eq("venta_id", venta.venta_id)
      .overrideTypes<ItemRow[]>(),
    supabase
      .from("venta_pagos")
      .select("medios_pago(nombre, tipo)")
      .eq("venta_id", venta.venta_id)
      .overrideTypes<PagoRow[]>(),
  ]);

  const pagosRows = pagosResult.data ?? [];
  const hayEfectivo = pagosRows.some((p) => p.medios_pago?.tipo === "efectivo");

  revalidatePath("/vender");
  revalidatePath("/productos");
  return ok({
    ventaId: venta.venta_id,
    items: (itemsResult.data ?? []).map((i) => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: Number(i.precio_unitario),
      subtotal: Number(i.subtotal),
    })),
    total: Number(venta.total),
    medioPagoNombre: pagosRows
      .map((p) => p.medios_pago?.nombre)
      .filter(Boolean)
      .join(" + "),
    vuelto: hayEfectivo ? Number(venta.vuelto) : null,
    fecha: venta.created_at,
  });
}
