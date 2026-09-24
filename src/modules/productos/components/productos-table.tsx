"use client";

import { useState } from "react";
import { eliminarProducto } from "../actions";
import type { Categoria } from "../categorias";
import type { Producto } from "../queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductoForm } from "./producto-form";
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

type ProductosTableProps = {
  productos: Producto[];
  categorias: Categoria[];
};

export function ProductosTable({
  productos,
  categorias,
}: ProductosTableProps) {
  const [busqueda, setBusqueda] = useState("");
  const [productosActuales, setProductosActuales] = useState(productos);
  const [productoEditando, setProductoEditando] = useState<Producto>();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [error, setError] = useState("");

  const filtrados = productosActuales.filter((producto) => {
    const term = busqueda.trim().toLowerCase();

    if (!term) {
      return true;
    }

    return (
      producto.nombre.toLowerCase().includes(term) ||
      producto.codigoBarras.toLowerCase().includes(term)
    );
  });

  function abrirNuevo() {
    setProductoEditando(undefined);
    setError("");
    setMostrarFormulario(true);
  }

  function abrirEditar(producto: Producto) {
    setProductoEditando(producto);
    setError("");
    setMostrarFormulario(true);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setProductoEditando(undefined);
    setError("");
  }

  async function handleEliminar(producto: Producto) {
    const confirmado = window.confirm(
      `¿Querés eliminar el producto "${producto.nombre}"?`,
    );

    if (!confirmado) {
      return;
    }

    setError("");

    const result = await eliminarProducto(producto.id);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setProductosActuales((actuales) =>
      actuales.filter((item) => item.id !== producto.id),
    );
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

        <Button type="button" onClick={abrirNuevo}>
          Nuevo producto
        </Button>
      </div>

      {mostrarFormulario && (
        <ProductoForm
          categorias={categorias}
          producto={productoEditando}
          onSuccess={() => {
            window.location.reload();
          }}
          onCancel={cerrarFormulario}
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
              <TableHead className="hidden sm:table-cell">
                Categoría
              </TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtrados.map((producto) => {
              const bajoMinimo =
                producto.stockActual < producto.stockMinimo;

              return (
                <TableRow key={producto.id}>
                  <TableCell>
                    <div className="font-medium">{producto.nombre}</div>
                    <div className="text-muted-foreground text-xs">
                      {producto.codigoBarras}
                    </div>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell">
                    {producto.categoriaNombre ?? "—"}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(producto.precio)}
                  </TableCell>

                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      bajoMinimo &&
                        "font-semibold text-red-600 dark:text-red-400",
                    )}
                  >
                    {producto.stockActual} {producto.unidadVenta}
                  </TableCell>

                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => abrirEditar(producto)}
                      >
                        Editar
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleEliminar(producto)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {filtrados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
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

