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
