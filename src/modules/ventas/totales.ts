// Totales del ticket, con el mismo redondeo que registrar_venta (0013):
//   descuento de la promo = calculado por la promo (ver promociones/logica.ts)
//   descuento manual     = round((bruto - promo) * pct_item / 100, 2)
//   descuento del total  = round(suma de netos * pct_total / 100, 2)
// Si la pantalla redondeara distinto, el pago no coincidiría con el total de la base (PV003).
// Se opera en centavos enteros para que no aparezcan errores del punto flotante.

export type LineaTotal = {
  precio: number;
  cantidad: number;
  descuentoPct: number;
  // Descuento de la promo que aplica a la línea (0 si no hay).
  promoDescuento?: number;
};

export type Totales = {
  bruto: number;
  descuentoItems: number;
  descuentoTotal: number;
  total: number;
};

const aCentavos = (pesos: number) => Math.round(pesos * 100);

// Lo que se descuenta de la línea: promo + manual (sobre el precio ya promocionado).
export function descuentoDeLinea(linea: LineaTotal): number {
  const brutoC = aCentavos(linea.precio) * linea.cantidad;
  const promoC = aCentavos(linea.promoDescuento ?? 0);
  const pctC = aCentavos(linea.descuentoPct); // porcentaje en centésimas
  const manualC = Math.round(((brutoC - promoC) * pctC) / 10000);
  return (promoC + manualC) / 100;
}

export function calcularTotales(
  lineas: LineaTotal[],
  descuentoTotalPct: number,
): Totales {
  let brutoC = 0;
  let descItemsC = 0;
  for (const linea of lineas) {
    brutoC += aCentavos(linea.precio) * linea.cantidad;
    descItemsC += aCentavos(descuentoDeLinea(linea));
  }
  const netoC = brutoC - descItemsC;
  const pctC = aCentavos(descuentoTotalPct);
  const descTotalC = Math.round((netoC * pctC) / 10000);
  return {
    bruto: brutoC / 100,
    descuentoItems: descItemsC / 100,
    descuentoTotal: descTotalC / 100,
    total: (netoC - descTotalC) / 100,
  };
}
