"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  anularVentaSchema,
  registrarVentaSchema,
  ventaSinConexionSchema,
  type AnularVentaInput,
  type RegistrarVentaInput,
  type VentaSinConexionInput,
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

// Ventas cobradas sin internet (0028). "registrada" incluye el reenvío de una venta que ya había
// entrado. "rechazada" es definitiva: la base no la va a aceptar aunque se reintente (por ejemplo,
// la caja ya se cerró), así que el dispositivo deja de reenviarla y la muestra. Un fail es
// transitorio (sin red, sesión vencida): el dispositivo la reintenta más tarde.
export type AvisoSinConexion = "precio" | "stock";
export type EnvioSinConexion =
  | {
      estado: "registrada";
      ventaId: string;
      avisos: AvisoSinConexion[];
      repetida: boolean;
    }
  | { estado: "rechazada"; motivo: string };

const PV_HORA_FUERA_DE_TURNO = "PV024";
const PV_ID_EN_USO = "PV025";

const RECHAZOS_SIN_CONEXION: Record<string, string> = {
  [PV_CAJA_INVALIDA]: "La caja de esta venta ya se cerró o no es tuya.",
  [PV_HORA_FUERA_DE_TURNO]:
    "La hora de la venta no coincide con el turno de la caja.",
  [PV_DESCUENTO_EXCEDIDO]: "La venta tiene un descuento mayor al permitido.",
  [PV_PRODUCTO_INEXISTENTE]: "Un producto de la venta ya no existe.",
  [PV_PAGO_INVALIDO]: "Los pagos de la venta no son válidos.",
  [PV_DATOS_INVALIDOS]: "La venta tiene cantidades o montos inválidos.",
  [PV_ID_EN_USO]: "La venta tiene un identificador repetido.",
  [PG_INSUFFICIENT_PRIVILEGE]: "Tu usuario no puede registrar ventas.",
};

export async function enviarVentaSinConexion(
  input: VentaSinConexionInput,
): Promise<ActionResult<EnvioSinConexion>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }
  const parsed = ventaSinConexionSchema.safeParse(input);
  if (!parsed.success) {
    return ok({
      estado: "rechazada",
      motivo: parsed.error.issues[0]?.message ?? "Datos de venta inválidos",
    });
  }
  const { ventaId, cajaId, fecha, items, pagos, descuento } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_venta_sin_conexion", {
    p_venta_id: ventaId,
    p_caja_id: cajaId,
    p_fecha: fecha,
    p_items: items.map((i) => ({
      producto_id: i.productoId,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
      descuento: i.descuento,
      promocion_descuento: i.promocionDescuento,
      promocion_nombre: i.promocionNombre,
    })),
    p_pagos: pagos.map((p) => ({
      medio_pago_id: p.medioPagoId,
      monto: p.monto,
      ...(p.recibido !== undefined ? { recibido: p.recibido } : {}),
    })),
    p_descuento: descuento,
  });

  if (error) {
    const motivo = RECHAZOS_SIN_CONEXION[error.code];
    if (motivo) return ok({ estado: "rechazada", motivo });
    if (error.code === PG_NOT_AUTHENTICATED) {
      return fail("Tu sesión venció. Volvé a ingresar para enviar las ventas.");
    }
    return fail("No se pudo enviar la venta. Se reintenta sola.");
  }

  const r = data as {
    venta_id: string;
    avisos: AvisoSinConexion[];
    repetida: boolean;
  };
  revalidatePath("/vender");
  revalidatePath("/productos");
  return ok({
    estado: "registrada",
    ventaId: r.venta_id,
    avisos: r.avisos ?? [],
    repetida: Boolean(r.repetida),
  });
}
