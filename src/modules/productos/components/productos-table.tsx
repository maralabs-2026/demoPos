"use client";

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import type { Producto } from "../queries";

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

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscá por nombre o código de barras..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden sm:table-cell">Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((p) => {
              const bajoMinimo = p.stockActual < p.stockMinimo;
              return (
                <TableRow
                  key={p.id}
                  className={cn(bajoMinimo && "bg-red-50 dark:bg-red-950/40")}
                >
                  <TableCell>
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-muted-foreground text-xs">
                      {p.codigoBarras}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {p.categoriaNombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.precio)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      bajoMinimo &&
                        "font-semibold text-red-600 dark:text-red-400",
                    )}
                  >
                    {p.stockActual} {p.unidadVenta}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground text-center"
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
