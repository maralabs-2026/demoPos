export type LineaReposicion = {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  cantidad: number;
};

type ProductoConStock = {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
};

// Productos bajo el mínimo, con la cantidad para llegar al doble del mínimo. Un stock negativo no
// debería existir, pero si aparece se repone desde cero.
export function sugerirReposicion(
  productos: readonly ProductoConStock[],
): LineaReposicion[] {
  return productos
    .filter((p) => p.stockMinimo > 0 && p.stockActual < p.stockMinimo)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
      cantidad: p.stockMinimo * 2 - Math.max(p.stockActual, 0),
    }));
}

export function reposicionComoTexto(
  lineas: readonly LineaReposicion[],
  comercio: string,
): string {
  return [
    `Reposición${comercio ? ` - ${comercio}` : ""}`,
    "",
    ...lineas.map((l) => `${l.cantidad} × ${l.nombre}`),
  ].join("\n");
}
