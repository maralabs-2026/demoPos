import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/result";

const API = "https://api.mercadopago.com/v1/orders";
const TIMEOUT_MS = 10_000;

// Solo servidor: la variable no lleva el prefijo NEXT_PUBLIC_.
export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

const ordenSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  external_reference: z.string().nullish(),
  total_amount: z.string().nullish(),
  total_paid_amount: z.string().nullish(),
});

export type OrdenMp = z.infer<typeof ordenSchema>;

type NuevaOrden = {
  cobroId: string;
  monto: number;
  externalPosId: string;
};

async function pedir(
  ruta: string,
  init: RequestInit,
): Promise<ActionResult<OrdenMp>> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return fail("Mercado Pago no está configurado.");

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API}${ruta}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    return fail("No pudimos comunicarnos con Mercado Pago. Probá de nuevo.");
  }

  if (!respuesta.ok) {
    return fail("Mercado Pago rechazó la operación. Probá de nuevo.");
  }
  const orden = ordenSchema.safeParse(await respuesta.json().catch(() => null));
  if (!orden.success) {
    return fail("Mercado Pago devolvió una respuesta inesperada.");
  }
  return ok(orden.data);
}

// El id del cobro es también la clave de idempotencia: reintentar no crea otra orden.
export function crearOrden({ cobroId, monto, externalPosId }: NuevaOrden) {
  const total = monto.toFixed(2);
  return pedir("", {
    method: "POST",
    headers: { "X-Idempotency-Key": cobroId },
    body: JSON.stringify({
      type: "qr",
      total_amount: total,
      description: "Venta en mostrador",
      external_reference: cobroId,
      expiration_time: "PT15M",
      config: { qr: { external_pos_id: externalPosId, mode: "static" } },
      transactions: { payments: [{ amount: total }] },
    }),
  });
}

export function consultarOrden(orderId: string) {
  return pedir(`/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export function cancelarOrden(orderId: string, cobroId: string) {
  return pedir(`/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: { "X-Idempotency-Key": `cancel-${cobroId}` },
  });
}
