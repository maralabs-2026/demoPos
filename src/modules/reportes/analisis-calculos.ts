// Cálculos de la pantalla de análisis, sin base de datos, para poder testearlos.

type Fila = { ventas: number; total: number };

// Margen sobre lo vendido con costo cargado; lo vendido sin costo no entra. null si no hay nada.
export function margenCategoria(
  ganancia: number,
  totalConCosto: number,
): number | null {
  return totalConCosto > 0 ? (ganancia / totalConCosto) * 100 : null;
}

// De la primera a la última hora con ventas, con las horas del medio en cero.
export function horasContinuas(
  filas: readonly (Fila & { hora: number })[],
): (Fila & { hora: number })[] {
  if (filas.length === 0) return [];
  const porHora = new Map(filas.map((f) => [f.hora, f]));
  const desde = Math.min(...filas.map((f) => f.hora));
  const hasta = Math.max(...filas.map((f) => f.hora));
  return Array.from({ length: hasta - desde + 1 }, (_, i) => {
    const hora = desde + i;
    return porHora.get(hora) ?? { hora, ventas: 0, total: 0 };
  });
}

const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // De lunes a domingo; en la base, 0 es domingo.

export function semanaCompleta(
  filas: readonly (Fila & { dia: number })[],
): (Fila & { dia: number })[] {
  const porDia = new Map(filas.map((f) => [f.dia, f]));
  return ORDEN_SEMANA.map(
    (dia) => porDia.get(dia) ?? { dia, ventas: 0, total: 0 },
  );
}

// Ancho de la barra en %, con un mínimo para que un valor chico se vea.
export function anchoBarra(valor: number, maximo: number): number {
  if (valor <= 0 || maximo <= 0) return 0;
  return Math.max(2, Math.round((valor / maximo) * 100));
}
