// Cuentas de una compra, en centavos y con el mismo redondeo que registrar_compra (0035): la
// pantalla muestra el total y la base es la que lo guarda.

const aCentavos = (pesos: number) => Math.round(pesos * 100);

export type LineaCompra = {
  cantidad: number;
  costoLista: number;
  bonificacionPct: number;
};

export function costoFinal(
  costoLista: number,
  bonificacionPct: number,
): number {
  const lista = aCentavos(costoLista);
  const pct = aCentavos(bonificacionPct); // porcentaje en centésimas
  return Math.round((lista * (10000 - pct)) / 10000) / 100;
}

export function subtotalLinea(linea: LineaCompra): number {
  const costo = costoFinal(linea.costoLista, linea.bonificacionPct);
  return (aCentavos(costo) * linea.cantidad) / 100;
}

export function totalCompra(lineas: readonly LineaCompra[]): number {
  return lineas.reduce((acc, l) => acc + aCentavos(subtotalLinea(l)), 0) / 100;
}

// Margen sobre el precio, el mismo de la tabla de productos.
export function margenSobrePrecio(costo: number, precio: number): number {
  return ((precio - costo) / precio) * 100;
}
