// Sin stock o bajo el mínimo: la regla del aviso de /productos, de su filtro y del rótulo de cada
// fila. Un servicio no lleva stock y nunca alerta.
export type EstadoStock = "servicio" | "sin_stock" | "bajo_minimo" | "al_dia";

export type FiltroStock = "todos" | "faltantes" | "sin_stock" | "bajo_minimo";

type ConStock = {
  controlaStock: boolean;
  stockActual: number;
  stockMinimo: number;
};

export function estadoStock(producto: ConStock): EstadoStock {
  if (!producto.controlaStock) return "servicio";
  if (producto.stockActual <= 0) return "sin_stock";
  if (producto.stockActual < producto.stockMinimo) return "bajo_minimo";
  return "al_dia";
}

export function pasaFiltroStock(
  producto: ConStock,
  filtro: FiltroStock,
): boolean {
  if (filtro === "todos") return true;
  const estado = estadoStock(producto);
  if (filtro === "faltantes") {
    return estado === "sin_stock" || estado === "bajo_minimo";
  }
  return estado === filtro;
}

export function contarPorFiltroStock(
  productos: ConStock[],
): Record<Exclude<FiltroStock, "todos">, number> {
  const total = { faltantes: 0, sin_stock: 0, bajo_minimo: 0 };
  for (const producto of productos) {
    const estado = estadoStock(producto);
    if (estado !== "sin_stock" && estado !== "bajo_minimo") continue;
    total.faltantes += 1;
    total[estado] += 1;
  }
  return total;
}

// El valor llega de la URL: cualquier otra cosa muestra la lista completa.
export function parseFiltroStock(
  valor: string | null | undefined,
): FiltroStock {
  return valor === "faltantes" ||
    valor === "sin_stock" ||
    valor === "bajo_minimo"
    ? valor
    : "todos";
}
