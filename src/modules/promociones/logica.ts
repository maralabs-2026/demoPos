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

// Combo fijo (0014): varios productos distintos por un precio fijo. Espejo de la lógica de
// registrar_venta: se aplica solo con todos sus productos, tantas veces como entren, sobre las
// unidades que no usó otro combo; el descuento se reparte por precio, el resto va al menor
// producto_id.
export type ComboItem = { productoId: string; cantidad: number };

export type Combo = {
  id: string;
  nombre: string;
  precio: number;
  // Mismo formato que Promo: días 0-6 y franja HH:MM:SS en hora de Córdoba.
  dias: number[];
  desde: string;
  hasta: string;
  activa: boolean;
  items: ComboItem[];
};

// Lo que aporta el combo a una línea del ticket.
export type DescuentoCombo = { descuento: number; nombres: string[]; consumido: number };

// Combos en orden de creación, como los devuelve la consulta.
export function aplicarCombos(
  lineas: LineaPromo[],
  combos: Combo[],
  ahora: Ahora,
): Map<string, DescuentoCombo> {
  const estado = new Map(
    lineas.map((l) => [
      l.productoId,
      { precio: l.precio, cantidad: l.cantidad, descC: 0, consumido: 0, nombres: [] as string[] },
    ]),
  );

  for (const combo of combos) {
    const vigente =
      combo.activa &&
      combo.dias.includes(ahora.dia) &&
      ahora.hora >= combo.desde &&
      ahora.hora <= combo.hasta;
    if (!vigente || combo.items.length < 2) continue;

    const partes = combo.items.map((item) => ({ item, linea: estado.get(item.productoId) }));
    if (partes.some((p) => !p.linea)) continue;

    const k = Math.min(
      ...partes.map((p) => Math.floor((p.linea!.cantidad - p.linea!.consumido) / p.item.cantidad)),
    );
    if (k <= 0) continue;

    const brutoUnitC = partes.reduce(
      (acc, p) => acc + aCentavos(p.linea!.precio) * p.item.cantidad,
      0,
    );
    const descUnitC = brutoUnitC - aCentavos(combo.precio);
    if (descUnitC <= 0) continue;
    const descKC = descUnitC * k;
    const brutoKC = brutoUnitC * k;

    // Reparto: cada línea (salvo la de menor producto_id) recibe su parte redondeada; esa, el resto.
    const ordenados = [...partes].sort((a, b) =>
      a.item.productoId < b.item.productoId ? -1 : 1,
    );
    const repartos = new Map<string, number>();
    let otrosC = 0;
    for (const p of ordenados.slice(1)) {
      const xC = aCentavos(p.linea!.precio) * p.item.cantidad * k;
      const parte = Math.round((descKC * xC) / brutoKC);
      repartos.set(p.item.productoId, parte);
      otrosC += parte;
    }
    repartos.set(ordenados[0].item.productoId, descKC - otrosC);

    partes.forEach((p) => {
      const linea = p.linea!;
      linea.descC += repartos.get(p.item.productoId) ?? 0;
      linea.consumido += p.item.cantidad * k;
      linea.nombres.push(combo.nombre);
    });
  }

  return new Map(
    [...estado.entries()].map(([id, e]) => [
      id,
      { descuento: e.descC / 100, nombres: e.nombres, consumido: e.consumido },
    ]),
  );
}
