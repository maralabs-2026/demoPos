import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarOrden, type OrdenMp } from "./cliente";

const ESTADOS: Record<string, string> = {
  processed: "aprobado",
  canceled: "cancelado",
  expired: "expirado",
  refunded: "reintegrado",
};

type EstadoAplicable = {
  cobroId: string;
  estado: string;
  montoPagado: number | null;
};

// null: la orden sigue en curso o no es de este sistema.
export function estadoDeOrden(orden: OrdenMp): EstadoAplicable | null {
  const estado = ESTADOS[orden.status];
  const cobroId = z.uuid().safeParse(orden.external_reference);
  if (!estado || !cobroId.success) return null;
  const pagado = Number(orden.total_paid_amount);
  return {
    cobroId: cobroId.data,
    estado,
    montoPagado:
      orden.total_paid_amount && Number.isFinite(pagado) ? pagado : null,
  };
}

// La única puerta para aplicar un resultado: siempre sale de consultar la orden a Mercado Pago.
export async function sincronizarOrden(
  orderId: string,
): Promise<ActionResult<string | null>> {
  const orden = await consultarOrden(orderId);
  if (!orden.ok) return orden;

  const aplicable = estadoDeOrden(orden.data);
  if (!aplicable) return ok(null);

  const { data, error } = await createAdminClient().rpc(
    "aplicar_estado_mp_cobro",
    {
      p_cobro_id: aplicable.cobroId,
      p_order_id: orden.data.id,
      p_estado: aplicable.estado,
      p_monto_pagado: aplicable.montoPagado,
    },
  );
  if (error) return fail("No pudimos guardar el resultado del cobro.");
  return ok(data);
}
