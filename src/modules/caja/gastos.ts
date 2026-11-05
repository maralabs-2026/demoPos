// Reglas de gastos para mostrar. Las fechas son "aaaa-mm-dd": se comparan como texto.

export function estaVencido(vencimiento: string | null, hoy: string): boolean {
  return vencimiento !== null && vencimiento < hoy;
}

export type CajaDelGasto = {
  id: string;
  estado: "abierta" | "cerrada";
  usuarioId: string;
};

// Dónde se ve el retiro de un gasto: en la caja en curso o en el detalle de su cierre.
export function hrefDeCaja(caja: CajaDelGasto, usuarioId: string): string {
  if (caja.estado === "cerrada") return `/caja/historial/${caja.id}`;
  return caja.usuarioId === usuarioId ? "/caja" : `/caja/cerrar/${caja.id}`;
}

export function avisoRetiro(nombreCaja: string): string {
  return `Se registró el retiro en ${nombreCaja}.`;
}
