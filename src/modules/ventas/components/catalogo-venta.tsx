"use client";

import type { CSSProperties } from "react";
import { LayoutGrid } from "lucide-react";
import { FotoProducto } from "@/components/foto-producto";
import type { Producto } from "@/modules/productos";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

// Piezas visuales del catálogo de la pantalla de cobro. La lógica (carrito, stock, cobro) queda en
// venta-screen.tsx; acá solo se dibuja.

// Un color por categoría, tomado de la paleta de gráficos según su orden en la lista. Las
// categorías son datos del comercio: no se asocia ningún color ni ícono a un nombre.
const COLORES = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;

export function colorDeCategoria(indice: number): CSSProperties {
  const color = `var(${COLORES[Math.max(indice, 0) % COLORES.length]})`;
  return {
    "--cat": color,
    "--cat-suave": `color-mix(in oklch, ${color} 12%, var(--card))`,
  } as CSSProperties;
}

// "Coca-Cola 500 ml" → "CC"; "Yerba" → "YE".
function siglas(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (palabras.length === 0) return "?";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

// Foto del producto o, si no tiene, sus siglas sobre el color de la categoría.
export function VisualProducto({
  producto,
  indiceCategoria,
  className,
  chico = false,
}: {
  producto: Pick<Producto, "nombre" | "fotoUrl">;
  indiceCategoria: number;
  className?: string;
  chico?: boolean;
}) {
  if (producto.fotoUrl) {
    return (
      <FotoProducto
        src={producto.fotoUrl}
        entera
        className={cn("rounded-xl bg-muted", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={colorDeCategoria(indiceCategoria)}
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-(--cat-suave) font-bold tracking-tight text-(--cat)",
        chico ? "text-sm" : "text-3xl",
        className,
      )}
    >
      {siglas(producto.nombre)}
    </span>
  );
}

// Stock del celular: corto, con el mismo color de alerta que el StockChip.
function StockCorto({ producto }: { producto: Producto }) {
  if (!producto.controlaStock) {
    return (
      <span className="text-xs whitespace-nowrap text-muted-foreground lg:hidden">
        Servicio
      </span>
    );
  }
  const sin = producto.stockActual <= 0;
  const bajo = !sin && producto.stockActual < producto.stockMinimo;
  return (
    <span
      className={cn(
        "text-xs whitespace-nowrap tabular-nums lg:hidden",
        sin
          ? "font-semibold text-destructive"
          : bajo
            ? "font-semibold text-warning-foreground"
            : "text-muted-foreground",
      )}
    >
      {sin ? "Sin stock" : `${producto.stockActual} u.`}
    </span>
  );
}

// Estado del stock en escritorio: al día, bajo el mínimo o sin stock.
function StockChip({ producto }: { producto: Producto }) {
  if (!producto.controlaStock) {
    return (
      <span className="inline-flex h-[22px] items-center rounded-full bg-card/95 px-2 text-xs font-semibold whitespace-nowrap text-muted-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]">
        Servicio
      </span>
    );
  }
  const sin = producto.stockActual <= 0;
  const bajo = !sin && producto.stockActual < producto.stockMinimo;
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs font-semibold whitespace-nowrap tabular-nums shadow-[0_1px_2px_rgba(16,24,40,0.08)]",
        sin
          ? "bg-destructive-soft text-destructive"
          : bajo
            ? "bg-warning-soft text-warning-foreground"
            : "bg-card/95 text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          sin ? "bg-destructive" : bajo ? "bg-warning" : "bg-success",
        )}
      />
      {sin
        ? "Sin stock"
        : bajo
          ? `Bajo · ${producto.stockActual}`
          : `Stock ${producto.stockActual}`}
    </span>
  );
}

export function TarjetaProducto({
  producto,
  indiceCategoria,
  enTicket,
  sinStock,
  onAgregar,
}: {
  producto: Producto;
  indiceCategoria: number;
  enTicket: number;
  sinStock: boolean;
  onAgregar: () => void;
}) {
  return (
    <button
      type="button"
      aria-disabled={sinStock}
      onClick={onAgregar}
      className={cn(
        "relative flex min-w-0 flex-col gap-2 rounded-2xl bg-card p-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] ring-1 ring-border transition-shadow hover:shadow-[0_6px_16px_rgba(16,24,40,0.08)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        enTicket > 0 && "ring-2 ring-primary",
        sinStock && "cursor-not-allowed opacity-55 hover:shadow-none",
      )}
    >
      <span className="relative block">
        <VisualProducto
          producto={producto}
          indiceCategoria={indiceCategoria}
          className="h-28 w-full lg:h-32"
        />
        <span className="absolute top-2 right-2 hidden lg:block">
          <StockChip producto={producto} />
        </span>
        {enTicket > 0 && (
          <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground tabular-nums shadow-[0_2px_6px_rgba(37,99,235,0.35)]">
            <span className="sr-only">En el ticket: </span>
            {enTicket}
          </span>
        )}
      </span>
      <span className="line-clamp-2 min-h-[38px] px-1 text-sm leading-[19px] font-semibold">
        {producto.nombre}
      </span>
      <span className="flex items-center justify-between gap-2 px-1 pb-1">
        {producto.categoriaNombre ? (
          <span
            style={colorDeCategoria(indiceCategoria)}
            className="hidden min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground lg:inline-flex"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-(--cat)"
            />
            <span className="truncate">{producto.categoriaNombre}</span>
          </span>
        ) : (
          <span className="hidden lg:block" />
        )}
        <span className="shrink-0 font-display text-lg leading-[22px] font-bold whitespace-nowrap tabular-nums">
          {formatCurrency(producto.precio, { decimals: 0 })}
        </span>
        <StockCorto producto={producto} />
      </span>
    </button>
  );
}

// Selector de categoría: chips en el celular, tarjetas con la cantidad de productos en escritorio.
export function CategoriasVenta({
  categorias,
  todas,
  valor,
  onCambiar,
}: {
  // La primera es `todas`; el resto, en el orden que define el color de cada una.
  categorias: ReadonlyArray<{ nombre: string; cantidad: number }>;
  todas: string;
  valor: string;
  onCambiar: (categoria: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Categorías"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] lg:gap-3 [&::-webkit-scrollbar]:hidden"
    >
      {categorias.map((c, i) => {
        const activa = c.nombre === valor;
        const esTodas = c.nombre === todas;
        return (
          <button
            key={c.nombre}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambiar(c.nombre)}
            style={colorDeCategoria(i - 1)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-full bg-card pr-4 pl-1.5 text-left text-sm ring-1 ring-border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:h-auto lg:w-36 lg:flex-col lg:items-start lg:gap-2.5 lg:rounded-2xl lg:p-3",
              activa
                ? "bg-accent text-accent-foreground ring-primary"
                : "hover:bg-muted",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold lg:size-9",
                esTodas
                  ? activa
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground"
                  : "bg-(--cat-suave) text-(--cat)",
              )}
            >
              {esTodas ? (
                <LayoutGrid className="size-4" />
              ) : (
                c.nombre.trim().charAt(0).toUpperCase()
              )}
            </span>
            <span className="flex min-w-0 flex-col lg:w-full">
              <span className="truncate font-semibold whitespace-nowrap">
                {c.nombre}
              </span>
              <span
                className={cn(
                  "hidden text-xs tabular-nums lg:block",
                  activa ? "text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {c.cantidad} {c.cantidad === 1 ? "producto" : "productos"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
