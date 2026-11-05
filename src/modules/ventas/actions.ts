"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  anularVentaSchema,
  registrarVentaSchema,
  type AnularVentaInput,
  type RegistrarVentaInput,
} from "./schemas";

const PV_CAJA_CERRADA = "PV012";
const PV_ABRIR_CAJA = "PV018";
const PV_YA_ANULADA = "PV019";
const PV_ANULACION_INVALIDA = "PV020";

// Anula con anular_venta: marca, stock inverso y plata en una transacción. retiro es el efectivo
// que salió de la caja de quien anula; 0 si la caja de la venta seguía abierta.
export async function anularVenta(
  input: AnularVentaInput,
): Promise<ActionResult<{ retiro: number }>> {
  const parsed = anularVentaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("anular_venta", {
    p_venta_id: parsed.data.ventaId,
    p_motivo: parsed.data.motivo,
  });

  if (error) {
    switch (error.code) {
      case PG_INSUFFICIENT_PRIVILEGE:
        return fail("No tenés permiso para anular ventas.");
      case PV_ABRIR_CAJA:
        return fail(
          "La caja de esta venta ya se cerró. Abrí tu caja para devolver el efectivo y probá de nuevo.",
        );
      case PV_CAJA_CERRADA:
        return fail("Tu caja se cerró recién. Abrila y probá de nuevo.");
      case PV_YA_ANULADA:
        return fail("Esta venta ya está anulada.");
      case PV_ANULACION_INVALIDA:
        return fail("No se pudo anular: revisá el motivo.");
      default:
        return fail("No se pudo anular la venta. Probá de nuevo.");
    }
  }

  revalidatePath("/reportes");
  revalidatePath("/reportes/ventas");
  revalidatePath(`/reportes/ventas/${parsed.data.ventaId}`);
  revalidatePath("/caja");
  revalidatePath("/productos");
  revalidatePath("/vender");
  return ok({
    retiro: Number((data as { retiro: number | null }).retiro ?? 0),
  });
}

export type ComprobanteItem = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  promocion: string | null;
  subtotal: number;
};

export type Comprobante = {
  ventaId: string;
  items: ComprobanteItem[];
  total: number;
  descuentoTotal: number;
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
const PV_DESCUENTO_EXCEDIDO = "PV011";

type RpcResult = {
  venta_id: string;
  total: number;
  descuento: number;
  vuelto: number;
  created_at: string;
};

type ItemRow = {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  promocion_nombre: string | null;
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
  const { cajaId, items, pagos, descuentoPct } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_venta", {
    p_caja_id: cajaId,
    p_items: items.map((i) => ({
      producto_id: i.productoId,
      cantidad: i.cantidad,
      descuento_pct: i.descuentoPct ?? 0,
    })),
    p_descuento_pct: descuentoPct ?? 0,
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
            "El total cambió porque se actualizó un precio, una promo o un combo. Revisá el ticket y cobrá de nuevo. Si vuelve a pasar, recargá la pantalla.",
          );
        }
        return fail("Elegí un medio de pago válido.");
      case PV_PRODUCTO_INEXISTENTE:
        return fail(
          "Un producto del ticket ya no existe. Recargá la pantalla.",
        );
      case PV_DESCUENTO_EXCEDIDO:
        return fail(
          `Ese descuento supera tu tope de ${error.details ?? "10"} %. Pedile a un encargado que lo haga.`,
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
      .select(
        "nombre, cantidad, precio_unitario, descuento, promocion_nombre, subtotal",
      )
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
      descuento: Number(i.descuento),
      promocion: i.promocion_nombre ?? null,
      subtotal: Number(i.subtotal),
    })),
    total: Number(venta.total),
    descuentoTotal: Number(venta.descuento ?? 0),
    medioPagoNombre: pagosRows
      .map((p) => p.medios_pago?.nombre)
      .filter(Boolean)
      .join(" + "),
    vuelto: hayEfectivo ? Number(venta.vuelto) : null,
    fecha: venta.created_at,
  });
}
