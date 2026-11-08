export type LineaReposicion = {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  cantidad: number;
  proveedorId: string | null;
};

type ProductoConStock = {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  proveedorId?: string | null;
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
      proveedorId: p.proveedorId ?? null,
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

export type PedidoProveedor = {
  proveedorId: string | null;
  nombre: string;
  telefono: string | null;
  lineas: LineaReposicion[];
};

// Un pedido por proveedor, por nombre, y al final lo que no tiene proveedor. Un proveedor habitual
// desactivado sigue agrupando: el producto todavía lo tiene asignado.
export function agruparPorProveedor(
  lineas: readonly LineaReposicion[],
  proveedores: readonly {
    id: string;
    nombre: string;
    telefono: string | null;
  }[],
): PedidoProveedor[] {
  const porId = new Map(proveedores.map((p) => [p.id, p]));
  const grupos = new Map<string | null, LineaReposicion[]>();
  for (const linea of lineas) {
    const clave =
      linea.proveedorId && porId.has(linea.proveedorId)
        ? linea.proveedorId
        : null;
    grupos.set(clave, [...(grupos.get(clave) ?? []), linea]);
  }
  const pedidos: PedidoProveedor[] = [...porId.values()]
    .filter((p) => grupos.has(p.id))
    .map((p) => ({
      proveedorId: p.id,
      nombre: p.nombre,
      telefono: p.telefono,
      lineas: grupos.get(p.id) ?? [],
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const sueltas = grupos.get(null);
  if (!sueltas) return pedidos;
  return [
    ...pedidos,
    {
      proveedorId: null,
      nombre: "Sin proveedor",
      telefono: null,
      lineas: sueltas,
    },
  ];
}
