// Formato de moneda del proyecto: "$ 1.234,56" (separador de miles punto, decimales coma).
const formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return `$ ${formatter.format(value)}`;
}
