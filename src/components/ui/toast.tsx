import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Check, TriangleAlert } from "lucide-react";

const iconVariants = cva(
  "grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4",
  {
    variants: {
      variant: {
        success: "bg-success text-success-foreground",
        error: "bg-destructive-soft text-destructive",
      },
    },
    defaultVariants: {
      variant: "success",
    },
  },
);

type ToastProps = VariantProps<typeof iconVariants> & {
  open: boolean;
  title: string;
  description?: string;
  className?: string;
};

/**
 * Aviso flotante abajo a la derecha. Es presentacional: quien lo usa maneja
 * `open` y el tiempo de cierre.
 *
 * Los lectores de pantalla no anuncian bien una región que aparece o cambia de
 * rol en el mismo render. Por eso el aviso visible va con aria-hidden y el texto
 * se anuncia en dos regiones fijas (status y alert) a las que solo les cambia el
 * contenido.
 */
function Toast({ open, title, description, variant, className }: ToastProps) {
  const Icon = variant === "error" ? TriangleAlert : Check;
  const anuncio = open ? [title, description].filter(Boolean).join(". ") : "";
  return (
    <>
      <p role="status" className="sr-only">
        {variant !== "error" ? anuncio : ""}
      </p>
      <p role="alert" className="sr-only">
        {variant === "error" ? anuncio : ""}
      </p>
      <div
        data-slot="toast"
        aria-hidden="true"
        className={cn(
          "fixed right-4 bottom-4 z-50 flex min-w-64 items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[0_18px_50px_rgba(20,25,21,0.18)] transition-all duration-250 sm:right-6 sm:bottom-6",
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
          className,
        )}
      >
        <span className={iconVariants({ variant })}>
          <Icon aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <strong className="text-sm">{title}</strong>
          {description && (
            <small className="text-xs text-muted-foreground">
              {description}
            </small>
          )}
        </div>
      </div>
    </>
  );
}

export { Toast };
