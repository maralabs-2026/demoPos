"use client";

import { useState } from "react";
import { crearProducto, editarProducto } from "../actions";
import type { Categoria } from "../categorias";
import type { Producto } from "../queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductoFormProps = {
  categorias: Categoria[];
  producto?: Producto;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ProductoForm({
  categorias,
  producto,
  onSuccess,
  onCancel,
}: ProductoFormProps) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [codigoBarras, setCodigoBarras] = useState(
    producto?.codigoBarras ?? "",
  );
  const [categoriaId, setCategoriaId] = useState(
  producto?.categoriaId ?? "",
);
  const [precio, setPrecio] = useState(
    producto?.precio !== undefined ? String(producto.precio) : "",
  );
  const [unidadVenta, setUnidadVenta] = useState(
    producto?.unidadVenta ?? "unidad",
  );
  const [stockMinimo, setStockMinimo] = useState(
    producto?.stockMinimo !== undefined ? String(producto.stockMinimo) : "0",
  );
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setGuardando(true);

    const input = {
      nombre,
      codigoBarras,
      categoriaId,
      precio: Number(precio),
      unidadVenta,
      stockMinimo: Number(stockMinimo),
    };

    const result = producto
      ? await editarProducto(producto.id, input)
      : await crearProducto(input);

    setGuardando(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      <div>
        <h2 className="text-lg font-medium">
          {producto ? "Editar producto" : "Nuevo producto"}
        </h2>
        <p className="text-muted-foreground text-sm">
          Completá los datos del producto.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-nombre" className="text-sm font-medium">
          Nombre
        </label>
        <Input
          id="producto-nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          placeholder="Ej. Coca Cola 500 ml"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-codigo" className="text-sm font-medium">
          Código de barras
        </label>
        <Input
          id="producto-codigo"
          value={codigoBarras}
          onChange={(event) => setCodigoBarras(event.target.value)}
          placeholder="Ej. 7791234567890"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-categoria" className="text-sm font-medium">
          Categoría
        </label>
        <select
          id="producto-categoria"
          value={categoriaId}
          onChange={(event) => setCategoriaId(event.target.value)}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
          required
        >
          <option value="">Seleccioná una categoría</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="producto-precio" className="text-sm font-medium">
            Precio
          </label>
          <Input
            id="producto-precio"
            type="number"
            min="0"
            step="0.01"
            value={precio}
            onChange={(event) => setPrecio(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="producto-unidad" className="text-sm font-medium">
            Unidad de venta
          </label>
          <Input
            id="producto-unidad"
            value={unidadVenta}
            onChange={(event) => setUnidadVenta(event.target.value)}
            placeholder="unidad"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-stock-minimo" className="text-sm font-medium">
          Stock mínimo
        </label>
        <Input
          id="producto-stock-minimo"
          type="number"
          min="0"
          step="1"
          value={stockMinimo}
          onChange={(event) => setStockMinimo(event.target.value)}
          required
        />
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : producto ? "Guardar cambios" : "Crear"}
        </Button>

        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

