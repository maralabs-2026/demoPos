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
  className?: string;
};

function QuantityStepper({
  value,
  onDecrement,
  onIncrement,
  min = 1,
  max,
  label,
  size,
  className,
}: QuantityStepperProps) {
  const buttonClass =
    "grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none disabled:opacity-40";
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
        onClick={onDecrement}
        disabled={value <= min}
        aria-label={`Restar uno${suffix}`}
      >
        <Minus aria-hidden="true" />
      </button>
      <span className="font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={buttonClass}
        onClick={onIncrement}
        disabled={max !== undefined && value >= max}
        aria-label={`Sumar uno${suffix}`}
      >
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

export { QuantityStepper };
