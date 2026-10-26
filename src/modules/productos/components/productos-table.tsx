"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { eliminarProducto } from "../actions";
import type { Categoria, Producto } from "../queries";
import { calcularMargen } from "../schemas";
import { ProductoForm } from "./producto-form";

type ProductosTableProps = {
  productos: Producto[];
  categorias: Categoria[];
  // Dueño o encargado. La RLS es la barrera real; esto solo oculta lo que fallaría.
  puedeGestionar: boolean;
};

export function ProductosTable({
  productos,
  categorias,
  puedeGestionar,
}: ProductosTableProps) {
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState<Producto | "nuevo" | null>(null);
  const [error, setError] = useState("");
  const [eliminando, setEliminando] = useState<string | null>(null);
  const router = useRouter();

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return productos;
    return productos.filter(
      (producto) =>
        producto.nombre.toLowerCase().includes(term) ||
        producto.codigoBarras.includes(term),
    );
  }, [productos, busqueda]);

  function cerrarFormulario() {
    setFormulario(null);
    router.refresh();
  }

  async function handleDelete(producto: Producto) {
    if (!window.confirm(`¿Eliminar ${producto.nombre}?`)) return;

    setError("");
    setEliminando(producto.id);
    const result = await eliminarProducto(producto.id);
    setEliminando(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscá por nombre o código de barras..."
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          className="max-w-sm"
        />
        {puedeGestionar && formulario === null && (
          <Button onClick={() => setFormulario("nuevo")}>Nuevo producto</Button>
        )}
      </div>

      {formulario && puedeGestionar && (
        <ProductoForm
          key={formulario === "nuevo" ? "nuevo" : formulario.id}
          categorias={categorias}
          producto={formulario === "nuevo" ? undefined : formulario}
          onSuccess={cerrarFormulario}
          onCancel={() => setFormulario(null)}
        />
      )}

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden sm:table-cell">Categoría</TableHead>
              {puedeGestionar && (
                <TableHead className="text-right">Costo</TableHead>
              )}
              <TableHead className="text-right">Precio</TableHead>
              {puedeGestionar && (
                <TableHead className="text-right">Margen</TableHead>
              )}
              <TableHead className="text-right">Stock</TableHead>
              {puedeGestionar && <TableHead>Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((producto) => {
              const bajoMinimo = producto.stockActual < producto.stockMinimo;
              const margen = calcularMargen(producto.costo, producto.precio);

              return (
                <TableRow
                  key={producto.id}
                  className={cn(bajoMinimo && "bg-red-50 dark:bg-red-950/40")}
                >
                  <TableCell>
                    <div className="font-medium">{producto.nombre}</div>
                    <div className="text-muted-foreground text-xs">
                      {producto.codigoBarras}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {producto.categoriaNombre ?? "—"}
                  </TableCell>
                  {puedeGestionar && (
                    <TableCell className="text-right tabular-nums">
                      {producto.costo === null
                        ? "—"
                        : formatCurrency(producto.costo)}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(producto.precio)}
                  </TableCell>
                  {puedeGestionar && (
                    <TableCell className="text-right tabular-nums">
                      {margen === null
                        ? "—"
                        : `${margen.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`}
                    </TableCell>
                  )}
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      bajoMinimo &&
                        "font-semibold text-red-600 dark:text-red-400",
                    )}
                  >
                    {producto.stockActual} {producto.unidadVenta}
                  </TableCell>
                  {puedeGestionar && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFormulario(producto)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={eliminando !== null}
                          onClick={() => void handleDelete(producto)}
                        >
                          {eliminando === producto.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={puedeGestionar ? 7 : 4}
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
