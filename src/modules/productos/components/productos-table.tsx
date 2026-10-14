"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import type { Producto } from "../queries";

function StockCell({ producto }: { producto: Producto }) {
  const stock = `${producto.stockActual} ${producto.unidadVenta}`;
  if (producto.stockActual <= 0) {
    return (
      <Badge variant="destructive" dot>
        Sin stock
      </Badge>
    );
  }
  if (producto.stockActual < producto.stockMinimo) {
    return (
      <Badge variant="warning" dot>
        {stock} · bajo mínimo
      </Badge>
    );
  }
  return <span className="tabular-nums">{stock}</span>;
}

export function ProductosTable({ productos }: { productos: Producto[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) || p.codigoBarras.includes(term),
    );
  }, [productos, busqueda]);

  const conAlerta = productos.filter(
    (p) => p.stockActual < p.stockMinimo,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Buscar producto"
            placeholder="Buscá por nombre o código de barras..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="rounded-full pl-11"
          />
        </div>
        {conAlerta > 0 && (
          <Badge variant="warning" dot>
            {conAlerta === 1
              ? "1 producto con stock bajo"
              : `${conAlerta} productos con stock bajo`}
          </Badge>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Producto</TableHead>
              <TableHead className="hidden sm:table-cell">Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-normal">
                  <div className="font-semibold">{p.nombre}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {p.codigoBarras}
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {p.categoriaNombre ?? "—"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(p.precio)}
                </TableCell>
                <TableCell className="text-right">
                  <StockCell producto={p} />
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  No se encontraron productos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
