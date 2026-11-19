import type { EstadoVerificacion } from "./schemas";

// Control de transferencias: si la plata de cada pago por transferencia llegó a la cuenta. La
// base guarda cada marca; el estado de un pago es la última, y sin marcas está pendiente.

export type EstadoTransferencia = EstadoVerificacion | "pendiente";

export type Verificacion = {
  estado: EstadoVerificacion;
  createdAt: string;
  autor: string;
};

export type Transferencia = {
  ventaPagoId: string;
  ventaId: string;
  createdAt: string;
  monto: number;
  medio: string;
  cajero: string;
  // De la más nueva a la más vieja.
  verificaciones: Verificacion[];
};

export function ordenarVerificaciones(v: Verificacion[]): Verificacion[] {
  return [...v].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function estadoTransferencia(t: Transferencia): EstadoTransferencia {
  return ordenarVerificaciones(t.verificaciones)[0]?.estado ?? "pendiente";
}

const centavos = (v: number) => Math.round(v * 100);

export function resumenTransferencias(transferencias: Transferencia[]) {
  const acc = {
    llego: { cantidad: 0, monto: 0 },
    no_llego: { cantidad: 0, monto: 0 },
    pendiente: { cantidad: 0, monto: 0 },
  };
  for (const t of transferencias) {
    const e = acc[estadoTransferencia(t)];
    e.cantidad += 1;
    e.monto += centavos(t.monto);
  }
  for (const e of Object.values(acc)) e.monto /= 100;
  return acc;
}

export type PorResolver = {
  cantidad: number;
  monto: number;
  // Día comercial de la más vieja, para ir directo a ese día.
  desde: string | null;
};

// Lo que el inicio muestra como pendiente: las que no llegaron, de cualquier día, y las sin
// verificar de días anteriores (las de hoy todavía se están cobrando). `diaDe` pasa un instante
// a su día comercial.
export function transferenciasPorResolver(
  transferencias: Transferencia[],
  hoy: string,
  diaDe: (iso: string) => string,
): { sinVerificar: PorResolver; noLlego: PorResolver } {
  const vacio = (): PorResolver => ({ cantidad: 0, monto: 0, desde: null });
  const sinVerificar = vacio();
  const noLlego = vacio();
  for (const t of transferencias) {
    const estado = estadoTransferencia(t);
    const dia = diaDe(t.createdAt);
    const destino =
      estado === "no_llego"
        ? noLlego
        : estado === "pendiente" && dia < hoy
          ? sinVerificar
          : null;
    if (!destino) continue;
    destino.cantidad += 1;
    destino.monto += centavos(t.monto);
    if (!destino.desde || dia < destino.desde) destino.desde = dia;
  }
  sinVerificar.monto /= 100;
  noLlego.monto /= 100;
  return { sinVerificar, noLlego };
}
