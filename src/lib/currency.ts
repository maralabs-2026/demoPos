// Formato de moneda del proyecto: "$ 1.234,56" (separador de miles punto, decimales coma).
const formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return `$ ${formatter.format(value)}`;
}

// Lee un monto escrito a mano: "1234,5", "1.234,50", "$ 1.234" o "1234.5".
// Devuelve null si el texto está vacío y NaN si no se entiende (nunca 0 por error).
export function parseMonto(texto: string): number | null {
  const limpio = texto.replace(/[\s$]/g, "");
  if (limpio === "") return null;

  let normalizado: string;
  if (limpio.includes(",")) {
    // Formato argentino: punto de miles, coma decimal.
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    // "1.234" o "12.500": puntos de miles sin decimales.
    normalizado = limpio.replace(/\./g, "");
  } else {
    normalizado = limpio;
  }

  if (!/^\d+(\.\d+)?$/.test(normalizado)) return Number.NaN;
  return Number(normalizado);
}

const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
});

// "33,3 %", o "—" si no hay valor.
export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${percentFormatter.format(value)} %`;
}
