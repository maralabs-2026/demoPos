"use client";

import { useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Minus, Plus } from "lucide-react";

const stepperVariants = cva(
  "inline-flex items-center justify-between rounded-full border border-border bg-card",
  {
    variants: {
      size: {
        sm: "h-8 w-28 p-0.5 text-xs [&_button]:size-7 [&_svg]:size-3.5",
        lg: "h-11.5 w-40 p-1 text-sm [&_button]:size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  },
);

type QuantityStepperProps = VariantProps<typeof stepperVariants> & {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
  /** Nombre del producto, para que los lectores de pantalla sepan qué cambia. */
  label?: string;
  /**
   * Si está, la cantidad se puede escribir (por ejemplo 24 latas) en lugar de
   * apretar "+" 23 veces. Recibe el valor ya acotado entre min y max.
   */
  onValueChange?: (value: number) => void;
  /** Enter en la cantidad escrita: por ejemplo, volver al buscador. */
  onEnter?: () => void;
  className?: string;
};

// Con mouse o touch, los botones no se quedan con el foco: así el lector de
// barras sigue escribiendo en el buscador y su Enter no aprieta "+".
function noRobarFoco(e: React.MouseEvent) {
  e.preventDefault();
}

function QuantityStepper({
  value,
  onDecrement,
  onIncrement,
  min = 1,
  max,
  label,
  onValueChange,
  onEnter,
  size,
  className,
}: QuantityStepperProps) {
  // null = no se está escribiendo: se muestra `value`.
  const [draft, setDraft] = useState<string | null>(null);

  function confirmar() {
    if (draft === null || !onValueChange) return;
    const n = Number.parseInt(draft, 10);
    if (Number.isInteger(n)) {
      const acotado = Math.max(min, max === undefined ? n : Math.min(n, max));
      if (acotado !== value) onValueChange(acotado);
    }
    setDraft(null);
  }

  const buttonClass =
    "grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-primary";
  // aria-disabled y no disabled: un botón deshabilitado pierde el foco y el teclado queda en <body>.
  const puedeRestar = value > min;
  const puedeSumar = max === undefined || value < max;
  const suffix = label ? ` de ${label}` : "";

  return (
    <div
      data-slot="quantity-stepper"
      role="group"
      aria-label={label ? `Cantidad de ${label}` : "Cantidad"}
      className={cn(stepperVariants({ size }), className)}
    >
      <button
        type="button"
        className={buttonClass}
        onMouseDown={noRobarFoco}
        onClick={() => puedeRestar && onDecrement()}
        aria-disabled={!puedeRestar}
        aria-label={`Restar uno${suffix}`}
      >
        <Minus aria-hidden="true" />
      </button>
      {onValueChange ? (
        <input
          type="text"
          inputMode="numeric"
          aria-label={label ? `Cantidad de ${label}` : "Cantidad"}
          value={draft ?? String(value)}
          onFocus={(e) => {
            setDraft(String(value));
            e.target.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/D/g, ""))}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmar();
              onEnter?.();
            } else if (e.key === "Escape") {
              setDraft(null);
              onEnter?.();
            }
          }}
          className="w-10 min-w-0 rounded-md bg-transparent text-center font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <span className="font-bold tabular-nums" aria-live="polite">
          {value}
        </span>
      )}
      <button
        type="button"
        className={buttonClass}
        onMouseDown={noRobarFoco}
        onClick={() => puedeSumar && onIncrement()}
        aria-disabled={!puedeSumar}
        aria-label={`Sumar uno${suffix}`}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

export { QuantityStepper };
