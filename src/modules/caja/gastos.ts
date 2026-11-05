// Reglas de gastos para mostrar. Las fechas son "aaaa-mm-dd": se comparan como texto.

export function estaVencido(vencimiento: string | null, hoy: string): boolean {
  return vencimiento !== null && vencimiento < hoy;
}
