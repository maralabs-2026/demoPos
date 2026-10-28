// Totales del ticket con descuentos, con el mismo redondeo que registrar_venta (0012):
//   descuento del ítem  = round(precio * cantidad * pct_item / 100, 2)
//   descuento del total = round(suma de netos * pct_total / 100, 2)
// Si la pantalla redondeara distinto, el pago no coincidiría con el total de la base (PV003).

export type LineaTotal = {
  precio: number;
  cantidad: number;
  descuentoPct: number;
};

export type Totales = {
  bruto: number;
  descuentoItems: number;
  descuentoTotal: number;
  total: number;
};

// Redondeo a centavos como round() de Postgres sobre numeric (mitad hacia arriba, positivos).
// Se trabaja en milésimos de centavo para que 0.005 no se pierda por el punto flotante.
const centavos = (pesos: number) =>
  Math.round(Math.round(pesos * 100_000) / 1000);

export function descuentoDeLinea(linea: LineaTotal): number {
  return (
    centavos((linea.precio * linea.cantidad * linea.descuentoPct) / 100) / 100
  );
}

export function calcularTotales(
  lineas: LineaTotal[],
  descuentoTotalPct: number,
): Totales {
  let brutoCent = 0;
  let descItemsCent = 0;
  for (const linea of lineas) {
    brutoCent += centavos(linea.precio * linea.cantidad);
    descItemsCent += centavos(descuentoDeLinea(linea));
  }
  const netoCent = brutoCent - descItemsCent;
  const descTotalCent = centavos(((netoCent / 100) * descuentoTotalPct) / 100);
  return {
    bruto: brutoCent / 100,
    descuentoItems: descItemsCent / 100,
    descuentoTotal: descTotalCent / 100,
    total: (netoCent - descTotalCent) / 100,
  };
}
