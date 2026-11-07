"use client";

import { useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { barrasEan13, MODULOS_EAN13 } from "@/lib/ean13";
import type { Producto } from "../queries";

// Mismo papel que el ticket: ancho del rollo y ancho imprimible en mm.
const ANCHOS = { 58: 52, 80: 72 } as const;
type Papel = keyof typeof ANCHOS;

export const ETIQUETAS_MAX = 100;
// Zona en blanco a cada lado del código: sin ella, el lector no encuentra dónde empieza.
const MARGEN_MODULOS = 9;

function CodigoBarras({ codigo }: { codigo: string }) {
  const barras = barrasEan13(codigo);
  if (!barras) return null;
  const ancho = MODULOS_EAN13 + MARGEN_MODULOS * 2;
  const rects: { x: number; w: number }[] = [];
  for (let i = 0; i < barras.length; i++) {
    if (barras[i] !== "1") continue;
    const ultimo = rects[rects.length - 1];
    if (ultimo && ultimo.x + ultimo.w === i + MARGEN_MODULOS) ultimo.w += 1;
    else rects.push({ x: i + MARGEN_MODULOS, w: 1 });
  }
  return (
    <svg
      viewBox={`0 0 ${ancho} 40`}
      preserveAspectRatio="none"
      className="h-12 w-full"
      role="img"
      aria-label={`Código de barras ${codigo}`}
      shapeRendering="crispEdges"
    >
      <rect width={ancho} height={40} fill="#fff" />
      {rects.map((r) => (
        <rect key={r.x} x={r.x} width={r.w} height={40} fill="#000" />
      ))}
    </svg>
  );
}

function Etiqueta({ producto }: { producto: Producto }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-white px-1 py-1.5 text-center text-black">
      <p className="line-clamp-2 text-[11px] leading-tight font-semibold break-words">
        {producto.nombre}
      </p>
      <p className="text-lg leading-tight font-bold tabular-nums">
        {formatCurrency(producto.precio)}
      </p>
      <CodigoBarras codigo={producto.codigoBarras} />
      <p className="font-mono text-[10px] tracking-[0.2em]">
        {producto.codigoBarras}
      </p>
    </div>
  );
}

export function EtiquetasDialog({
  producto,
  onClose,
}: {
  producto: Producto | null;
  onClose: () => void;
}) {
  const [cantidad, setCantidad] = useState("1");
  const [papel, setPapel] = useState<Papel>(58);
  const n = Number(cantidad);
  const valida = Number.isInteger(n) && n >= 1 && n <= ETIQUETAS_MAX;
  const dibujable = producto
    ? barrasEan13(producto.codigoBarras) !== null
    : false;

  function imprimir(elegido: Papel) {
    if (!valida) return;
    // Las etiquetas tienen que tener el ancho elegido antes de abrir el diálogo de impresión.
    flushSync(() => setPapel(elegido));
    window.print();
  }

  return (
    <Dialog
      open={producto !== null}
      onOpenChange={(abierto) => {
        if (!abierto) {
          setCantidad("1");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        {producto && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <DialogTitle>Etiquetas</DialogTitle>
              <DialogDescription>
                Imprimilas en la térmica del ticket y pegalas en el producto.
              </DialogDescription>
            </div>

            <div
              className="mx-auto w-full max-w-56 rounded-md border border-dashed border-border"
              data-testid="etiqueta-vista"
            >
              <Etiqueta producto={producto} />
            </div>
            {!dibujable && (
              <p className="text-xs text-muted-foreground">
                Este código no es un EAN-13: la etiqueta lleva el número, sin
                barras. Si el producto no tiene código de fábrica, editalo y
                generá uno.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etiquetas-cantidad"
                className="text-sm font-medium"
              >
                Cantidad
              </label>
              <Input
                id="etiquetas-cantidad"
                type="number"
                inputMode="numeric"
                min={1}
                max={ETIQUETAS_MAX}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                aria-invalid={!valida}
              />
              {!valida && (
                <p className="text-xs text-destructive" role="alert">
                  Elegí entre 1 y {ETIQUETAS_MAX} etiquetas.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={!valida}
                onClick={() => imprimir(58)}
              >
                <Printer data-icon="inline-start" />
                Imprimí 58 mm
              </Button>
              <Button
                variant="outline"
                disabled={!valida}
                onClick={() => imprimir(80)}
              >
                <Printer data-icon="inline-start" />
                Imprimí 80 mm
              </Button>
            </div>

            {/* Fuera del diálogo: su posición fija no tiene que mover lo impreso. */}
            {valida &&
              createPortal(
                <div
                  className="ticket-print hidden print:block"
                  style={{ width: `${ANCHOS[papel]}mm` }}
                >
                  <style>{`@media print { @page { size: ${papel}mm auto; margin: 0; } }`}</style>
                  {Array.from({ length: n }, (_, i) => (
                    <div
                      key={i}
                      className="border-b border-dashed border-black break-inside-avoid"
                    >
                      <Etiqueta producto={producto} />
                    </div>
                  ))}
                </div>,
                document.body,
              )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
