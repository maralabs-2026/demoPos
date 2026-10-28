"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, formatPercent } from "@/lib/currency";
import { eliminarProducto } from "../actions";
import type { Categoria, Producto } from "../queries";
import { calcularMargen } from "../schemas";
import { ProductoForm } from "./producto-form";

function StockCell({ producto }: { producto: Producto }) {
  const stock = `${producto.stockActual} ${producto.unidadVenta}`;
  if (producto.stockActual <= 0) {
    return (
      <Badge variant="destructive" dot>
        Sin stock
      </Badge>
    );
  }
  // Bajo mínimo en rojo, como pide la Fase D (no naranja).
  if (producto.stockActual < producto.stockMinimo) {
    return (
      <Badge variant="destructive" dot>
        {stock} · bajo mínimo
      </Badge>
    );
  }
  return <span className="tabular-nums">{stock}</span>;
}

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

  // Misma regla que StockCell: sin stock o bajo mínimo.
  const conAlerta = productos.filter(
    (p) => p.stockActual <= 0 || p.stockActual < p.stockMinimo,
  ).length;

  function cerrarFormulario() {
    setFormulario(null);
    router.refresh();
  }

  async function handleDelete(producto: Producto) {
    if (!window.confirm(`¿Eliminar ${producto.nombre}?`)) return;

    setError("");
    setEliminando(producto.id);
    try {
      const result = await eliminarProducto(producto.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Si el producto borrado estaba abierto en el formulario, se cierra.
      setFormulario((actual) =>
        actual !== null && actual !== "nuevo" && actual.id === producto.id
          ? null
          : actual,
      );
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisá la conexión y probá de nuevo.");
    } finally {
      setEliminando(null);
    }
  }

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
            onChange={(event) => setBusqueda(event.target.value)}
            className="rounded-full pl-11"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {conAlerta > 0 && (
            <Badge variant="destructive" dot>
              {conAlerta === 1
                ? "1 producto con stock bajo"
                : `${conAlerta} productos con stock bajo`}
            </Badge>
          )}
          {puedeGestionar && formulario === null && (
            <Button onClick={() => setFormulario("nuevo")}>
              Nuevo producto
            </Button>
          )}
        </div>
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
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
              const margen = calcularMargen(producto.costo, producto.precio);

              return (
                <TableRow key={producto.id}>
                  <TableCell className="whitespace-normal">
                    <div className="font-semibold">{producto.nombre}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {producto.codigoBarras}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {producto.categoriaNombre ?? "—"}
                  </TableCell>
                  {puedeGestionar && (
                    <TableCell className="text-right tabular-nums">
                      {producto.costo === null
                        ? "—"
                        : formatCurrency(producto.costo)}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(producto.precio)}
                  </TableCell>
                  {puedeGestionar && (
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(margen)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <StockCell producto={producto} />
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
