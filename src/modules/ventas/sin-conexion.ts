// Venta cobrada sin internet: arma lo que se envía a registrar_venta_sin_conexion (0028) y el
// comprobante que se muestra en el momento, a partir de lo que calculó la pantalla. Sin React y sin
// IndexedDB, para poder testearlo.

import type { Comprobante } from "./actions";
import type { PagoVenta, TipoMedio } from "./pagos";
import type { VentaSinConexionInput } from "./schemas";

// Una línea del ticket tal como se cobró. descuento = combo + promo + manual, en pesos.
export type LineaCobrada = {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  descuento: number;
  // Parte del descuento que viene de combos y promos (no cuenta para el tope del rol).
  promocionDescuento: number;
  promocionNombre: string | null;
};

type MedioNombrado = { id: string; nombre: string; tipo: TipoMedio };

const aCentavos = (pesos: number) => Math.round(pesos * 100);

export function armarVentaSinConexion(datos: {
  ventaId: string;
  cajaId: string;
  fecha: Date;
  lineas: LineaCobrada[];
  descuentoTotal: number;
  pagos: PagoVenta[];
}): VentaSinConexionInput {
  return {
    ventaId: datos.ventaId,
    cajaId: datos.cajaId,
    fecha: datos.fecha.toISOString(),
    items: datos.lineas.map((l) => ({
      productoId: l.productoId,
      cantidad: l.cantidad,
      precioUnitario: l.precio,
      descuento: l.descuento,
      promocionDescuento: l.promocionDescuento,
      promocionNombre: l.promocionDescuento > 0 ? l.promocionNombre : null,
    })),
    pagos: datos.pagos,
    descuento: datos.descuentoTotal,
  };
}

// El mismo comprobante que devuelve registrarVenta, armado en el dispositivo.
export function comprobanteSinConexion(
  venta: VentaSinConexionInput,
  lineas: LineaCobrada[],
  medios: MedioNombrado[],
): Comprobante {
  const porId = new Map(medios.map((m) => [m.id, m]));
  const items = lineas.map((l) => ({
    nombre: l.nombre,
    cantidad: l.cantidad,
    precioUnitario: l.precio,
    descuento: l.descuento,
    promocion: l.promocionDescuento > 0 ? l.promocionNombre : null,
    subtotal: (aCentavos(l.precio) * l.cantidad - aCentavos(l.descuento)) / 100,
  }));
  const netoC = items.reduce((acc, i) => acc + aCentavos(i.subtotal), 0);
  const hayEfectivo = venta.pagos.some(
    (p) => porId.get(p.medioPagoId)?.tipo === "efectivo",
  );
  const vueltoC = venta.pagos.reduce(
    (acc, p) =>
      porId.get(p.medioPagoId)?.tipo === "efectivo" && p.recibido !== undefined
        ? acc + aCentavos(p.recibido) - aCentavos(p.monto)
        : acc,
    0,
  );
  return {
    ventaId: venta.ventaId,
    items,
    total: (netoC - aCentavos(venta.descuento)) / 100,
    descuentoTotal: venta.descuento,
    medioPagoNombre: venta.pagos
      .map((p) => porId.get(p.medioPagoId)?.nombre)
      .filter(Boolean)
      .join(" + "),
    vuelto: hayEfectivo ? vueltoC / 100 : null,
    fecha: venta.fecha,
  };
}
