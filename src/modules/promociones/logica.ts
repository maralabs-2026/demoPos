// Reglas de las promos del ticket, sin React ni base, para poder testearlas. Replican
// descuento_promocion y registrar_venta (0013): si la pantalla calculara distinto, el pago no
// coincidiría con el total de la base (PV003). Todo se calcula en centavos enteros.

export type TipoPromo = "nxm" | "precio_cantidad" | "porcentaje";

export type Promo = {
  id: string;
  nombre: string;
  tipo: TipoPromo;
  alcance: "producto" | "categoria";
  productoId: string | null;
  categoriaId: string | null;
  lleva: number | null;
  paga: number | null;
  cantidad: number | null;
  precio: number | null;
  porcentaje: number | null;
  // 0 = domingo ... 6 = sábado, como en Postgres.
  dias: number[];
  // "HH:MM:SS", como devuelve Postgres para el tipo time.
  desde: string;
  hasta: string;
  activa: boolean;
};

export type Ahora = { dia: number; hora: string };

export type LineaPromo = {
  productoId: string;
  categoriaId: string | null;
  precio: number;
  cantidad: number;
};

const aCentavos = (pesos: number) => Math.round(pesos * 100);

// Hora y día de la semana en Córdoba (la base guarda UTC; la vigencia es local).
export function ahoraEnCordoba(fecha: Date = new Date()): Ahora {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    dia: dias.indexOf(valor("weekday")),
    hora: `${valor("hour")}:${valor("minute")}:${valor("second")}`,
  };
}

export function promoVigente(promo: Promo, ahora: Ahora): boolean {
  return (
    promo.activa &&
    promo.dias.includes(ahora.dia) &&
    ahora.hora >= promo.desde &&
    ahora.hora <= promo.hasta
  );
}

// Lo que se ahorra el cliente con esa cantidad de la promo (mismo cálculo que la base).
export function descuentoPromocion(
  promo: Promo,
  precio: number,
  cantidad: number,
): number {
  const precioC = aCentavos(precio);
  const brutoC = precioC * cantidad;

  if (promo.tipo === "porcentaje") {
    const pctC = aCentavos(promo.porcentaje ?? 0); // porcentaje con 2 decimales, en centésimas
    return Math.round((brutoC * pctC) / 10000) / 100;
  }
  if (promo.tipo === "nxm") {
    const lleva = promo.lleva ?? 0;
    const paga = promo.paga ?? 0;
    if (lleva <= 0 || cantidad < lleva) return 0;
    const grupos = Math.floor(cantidad / lleva);
    const cobradoC = grupos * paga * precioC + (cantidad % lleva) * precioC;
    return (brutoC - cobradoC) / 100;
  }
  // precio_cantidad: grupos de C unidades a un precio fijo X.
  const c = promo.cantidad ?? 0;
  if (c <= 0) return 0;
  const grupos = Math.floor(cantidad / c);
  if (grupos === 0) return 0;
  const precioPromoC = aCentavos(promo.precio ?? 0);
  const cobradoC = grupos * precioPromoC + (cantidad % c) * precioC;
  return Math.max(brutoC - cobradoC, 0) / 100;
}

// La promo de mayor descuento que aplica a la línea, o null si ninguna aplica.
export function mejorPromo(
  promos: Promo[],
  linea: LineaPromo,
  ahora: Ahora,
): { nombre: string; descuento: number } | null {
  let mejor: { nombre: string; descuento: number } | null = null;
  for (const promo of promos) {
    if (!promoVigente(promo, ahora)) continue;
    const aplica =
      (promo.alcance === "producto" && promo.productoId === linea.productoId) ||
      (promo.alcance === "categoria" &&
        promo.categoriaId === linea.categoriaId);
    if (!aplica) continue;
    const descuento = descuentoPromocion(promo, linea.precio, linea.cantidad);
    if (descuento > 0 && (mejor === null || descuento > mejor.descuento)) {
      mejor = { nombre: promo.nombre, descuento };
    }
  }
  return mejor;
}
