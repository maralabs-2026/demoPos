import { formatCurrency } from "@/lib/currency";

// Reglas del panel de pagos de /vender, sin React, para poder testearlas.
// La base vuelve a validar todo en registrar_venta (0007): esto solo da mensajes claros antes.

export type TipoMedio =
  "efectivo" | "tarjeta" | "transferencia" | "qr" | "cuenta_corriente";

export type MedioPagoRef = { id: string; tipo: TipoMedio };

// Una línea del pago combinado. En el combinado el efectivo se cobra justo (sin vuelto).
export type PagoParcial = {
  key: string;
  medioPagoId: string;
  monto: number | null;
};

export type ModoPago =
  | { tipo: "unico"; medioPagoId: string; recibido: number | null }
  | { tipo: "combinado"; pagos: PagoParcial[] };

export type PagoVenta = {
  medioPagoId: string;
  monto: number;
  recibido?: number;
};

export type PagosResueltos =
  | { ok: true; pagos: PagoVenta[]; vuelto: number | null }
  | { ok: false; error: string };

// Centavos enteros: evita que 0.1 + 0.2 deje un total que "no coincide" por un decimal.
const cents = (n: number) => Math.round(n * 100);

export function restantePorAsignar(
  total: number,
  pagos: PagoParcial[],
): number {
  const asignado = pagos.reduce((acc, p) => acc + cents(p.monto ?? 0), 0);
  return (cents(total) - asignado) / 100;
}

export function resolverPagos(
  total: number,
  modo: ModoPago,
  medios: MedioPagoRef[],
): PagosResueltos {
  if (!(total > 0)) return { ok: false, error: "El carrito está vacío" };
  const tipoDe = (id: string) => medios.find((m) => m.id === id)?.tipo;

  if (modo.tipo === "unico") {
    const tipo = tipoDe(modo.medioPagoId);
    if (!tipo) return { ok: false, error: "Elegí un medio de pago" };
    if (tipo !== "efectivo") {
      return {
        ok: true,
        pagos: [{ medioPagoId: modo.medioPagoId, monto: total }],
        vuelto: null,
      };
    }
    if (modo.recibido === null || cents(modo.recibido) < cents(total)) {
      return { ok: false, error: "El monto recibido es menor al total" };
    }
    return {
      ok: true,
      pagos: [
        {
          medioPagoId: modo.medioPagoId,
          monto: total,
          recibido: modo.recibido,
        },
      ],
      vuelto: (cents(modo.recibido) - cents(total)) / 100,
    };
  }

  const { pagos } = modo;
  if (pagos.length < 2) {
    return {
      ok: false,
      error: "Un pago combinado necesita al menos dos medios",
    };
  }
  if (pagos.some((p) => !tipoDe(p.medioPagoId))) {
    return { ok: false, error: "Elegí un medio de pago en cada línea" };
  }
  if (new Set(pagos.map((p) => p.medioPagoId)).size !== pagos.length) {
    return { ok: false, error: "Usá cada medio de pago una sola vez" };
  }
  if (pagos.some((p) => p.monto === null || !(p.monto > 0))) {
    return { ok: false, error: "Completá el monto de cada medio de pago" };
  }
  const restante = restantePorAsignar(total, pagos);
  if (restante > 0) {
    return {
      ok: false,
      error: `Faltan ${formatCurrency(restante)} para cubrir el total`,
    };
  }
  if (restante < 0) {
    return {
      ok: false,
      error: `Los pagos superan el total por ${formatCurrency(-restante)}`,
    };
  }
  return {
    ok: true,
    pagos: pagos.map((p) => ({
      medioPagoId: p.medioPagoId,
      monto: p.monto as number,
    })),
    vuelto: null,
  };
}
