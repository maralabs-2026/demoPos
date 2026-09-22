"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  calcularMargen,
  productoFormSchema,
  type ProductoFormInput,
} from "../schemas";
import type { Categoria } from "../queries";

const selectClassName =
  "h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

type Campo = keyof ProductoFormInput;
type ValoresCrudos = Record<Campo, string>;

const valoresIniciales = (
  producto?: Partial<ProductoFormInput>,
): ValoresCrudos => ({
  nombre: producto?.nombre ?? "",
  categoriaId: producto?.categoriaId ?? "",
  codigoBarras: producto?.codigoBarras ?? "",
  costo: producto?.costo !== undefined ? String(producto.costo) : "",
  precio: producto?.precio !== undefined ? String(producto.precio) : "",
  unidadVenta: producto?.unidadVenta ?? "unidad",
  stockMinimo:
    producto?.stockMinimo !== undefined ? String(producto.stockMinimo) : "0",
});

export function ProductoForm({
  categorias,
  producto,
  onSubmit,
  submitLabel = "Guardar",
}: {
  categorias: Categoria[];
  producto?: Partial<ProductoFormInput>;
  onSubmit: (data: ProductoFormInput) => void | Promise<void>;
  submitLabel?: string;
}) {
  const [valores, setValores] = useState<ValoresCrudos>(
    valoresIniciales(producto),
  );
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [enviando, setEnviando] = useState(false);

  const set = (campo: Campo) => (e: { target: { value: string } }) =>
    setValores((prev) => ({ ...prev, [campo]: e.target.value }));

  const precioNumero = Number(valores.precio);
  const costoNumero = valores.costo === "" ? undefined : Number(valores.costo);
  const margen = calcularMargen(precioNumero, costoNumero);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const resultado = productoFormSchema.safeParse(valores);

    if (!resultado.success) {
      const nuevosErrores: Partial<Record<Campo, string>> = {};
      for (const issue of resultado.error.issues) {
        const campo = issue.path[0] as Campo;
        if (!nuevosErrores[campo]) nuevosErrores[campo] = issue.message;
      }
      setErrores(nuevosErrores);
      return;
    }

    setErrores({});
    setEnviando(true);
    Promise.resolve(onSubmit(resultado.data)).finally(() => setEnviando(false));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="nombre" className="text-sm font-medium">
          Nombre
        </label>
        <Input id="nombre" value={valores.nombre} onChange={set("nombre")} />
        {errores.nombre && (
          <p className="text-destructive text-sm">{errores.nombre}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="categoria" className="text-sm font-medium">
            Categoría
          </label>
          <select
            id="categoria"
            className={selectClassName}
            value={valores.categoriaId}
            onChange={set("categoriaId")}
          >
            <option value="">Elegí una categoría...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {errores.categoriaId && (
            <p className="text-destructive text-sm">{errores.categoriaId}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="unidadVenta" className="text-sm font-medium">
            Unidad de venta
          </label>
          <select
            id="unidadVenta"
            className={selectClassName}
            value={valores.unidadVenta}
            onChange={set("unidadVenta")}
          >
            <option value="unidad">Unidad</option>
            <option value="pack">Pack</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="codigoBarras" className="text-sm font-medium">
          Código de barras
        </label>
        <Input
          id="codigoBarras"
          value={valores.codigoBarras}
          onChange={set("codigoBarras")}
          inputMode="numeric"
        />
        {errores.codigoBarras && (
          <p className="text-destructive text-sm">{errores.codigoBarras}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="costo" className="text-sm font-medium">
            Costo (opcional)
          </label>
          <Input
            id="costo"
            type="number"
            min={0}
            step="0.01"
            value={valores.costo}
            onChange={set("costo")}
          />
          {errores.costo && (
            <p className="text-destructive text-sm">{errores.costo}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="precio" className="text-sm font-medium">
            Precio
          </label>
          <Input
            id="precio"
            type="number"
            min={0}
            step="0.01"
            value={valores.precio}
            onChange={set("precio")}
          />
          {errores.precio && (
            <p className="text-destructive text-sm">{errores.precio}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="stockMinimo" className="text-sm font-medium">
            Stock mínimo
          </label>
          <Input
            id="stockMinimo"
            type="number"
            min={0}
            step="1"
            value={valores.stockMinimo}
            onChange={set("stockMinimo")}
          />
          {errores.stockMinimo && (
            <p className="text-destructive text-sm">{errores.stockMinimo}</p>
          )}
        </div>
      </div>

      <div className="bg-muted rounded-md p-3 text-sm">
        <span className="text-muted-foreground">Margen: </span>
        <span
          className={cn(
            "font-medium",
            margen !== null && margen < 0 && "text-destructive",
          )}
        >
          {margen === null
            ? "— (cargá el costo para verlo)"
            : `${margen.toFixed(1)}% sobre ${formatCurrency(precioNumero || 0)}`}
        </span>
      </div>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
