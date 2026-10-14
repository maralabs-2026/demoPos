// Formato de moneda del proyecto: "$ 1.234,56" (separador de miles punto, decimales coma).
const formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return `$ ${formatter.format(value)}`;
}

/** Igual que `formatCurrency` pero sin el signo, para inputs con prefijo "$". */
export function formatAmount(value: number): string {
  return formatter.format(value);
}

/**
 * Interpreta un monto escrito en formato argentino: el punto separa miles y
 * la coma, decimales ("1.234,56" → 1234.56). Acepta el "$" y espacios.
 * Devuelve `null` si está vacío, es negativo o no es un monto válido.
 */
export function parseCurrency(text: string): number | null {
  const clean = text.replace(/\$/g, "").replace(/\s/g, "");
  if (!/^\d[\d.]*(,\d{0,2})?$/.test(clean)) return null;
  const value = Number(clean.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
