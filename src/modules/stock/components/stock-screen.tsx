"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import type { Producto } from "@/modules/productos";
import { cn } from "@/lib/utils";
import { MovimientoForm } from "./movimiento-form";

const MAX_RESULTADOS = 8;

export function StockScreen({
  productos,
  productoSeleccionadoId,
  historial,
}: {
  productos: Producto[];
  productoSeleccionadoId: string | null;
  historial: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!productoSeleccionadoId) inputRef.current?.focus();
  }, [productoSeleccionadoId]);

  const seleccionado = productos.find((p) => p.id === productoSeleccionadoId) ?? null;

  const resultados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return [];
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) || p.codigoBarras.toLowerCase().includes(term),
      )
      .slice(0, MAX_RESULTADOS);
  }, [productos, busqueda]);

  function seleccionar(producto: Producto) {
    setBusqueda("");
    setAviso(null);
    router.replace(`${pathname}?producto=${producto.id}`, { scroll: false });
  }

  function handleBuscarSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = busqueda.trim();
    if (!term) return;
    // Lector de barras: el código llega completo seguido de Enter.
    // Códigos internos como "PAN-ART01" pueden tener letras: se comparan sin mayúsculas.
    const porCodigo = productos.find((p) => p.codigoBarras.toLowerCase() === term.toLowerCase());
    if (porCodigo) return seleccionar(porCodigo);
    if (resultados.length === 1) return seleccionar(resultados[0]);
    setAviso(
      resultados.length > 1
        ? "Hay más de un producto que coincide. Elegilo de la lista."
        : `No se encontró "${term}"`,
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleBuscarSubmit} className="max-w-md space-y-2">
        <Input
          ref={inputRef}
          id="stock-busqueda"
          placeholder="Buscá por nombre o escaneá el código"
          autoComplete="off"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setAviso(null);
          }}
        />
        {aviso && <p className="text-muted-foreground text-sm">{aviso}</p>}
        {resultados.length > 0 && (
          <ul className="divide-y rounded-md border">
            {resultados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => seleccionar(p)}
                  className="hover:bg-muted focus-visible:bg-muted flex w-full items-center justify-between gap-3 p-3 text-left text-sm outline-none"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{p.nombre}</span>
                    <span className="text-muted-foreground block text-xs">{p.codigoBarras}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {p.stockActual} {p.unidadVenta}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {seleccionado ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <section className="space-y-4 rounded-md border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-medium">{seleccionado.nombre}</h2>
                <p className="text-muted-foreground text-xs">{seleccionado.codigoBarras}</p>
              </div>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  seleccionado.stockActual < seleccionado.stockMinimo &&
                    "text-red-600 dark:text-red-400",
                )}
              >
                {seleccionado.stockActual}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {seleccionado.unidadVenta} · mínimo {seleccionado.stockMinimo}
                </span>
              </p>
            </div>
            <MovimientoForm
              key={seleccionado.id}
              productoId={seleccionado.id}
              stockActual={seleccionado.stockActual}
              unidadVenta={seleccionado.unidadVenta}
              onRegistrado={(stock, mensaje) => {
                setAviso(`${mensaje}. Stock de "${seleccionado.nombre}": ${stock}.`);
                router.refresh();
                inputRef.current?.focus();
              }}
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Últimos movimientos</h2>
            {historial}
          </section>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Elegí un producto para cargar un ingreso o un ajuste.
        </p>
      )}
    </div>
  );
}
