import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { Movimiento, TipoMovimiento } from "../queries";

const ETIQUETA: Record<TipoMovimiento, string> = {
  ingreso: "Ingreso",
  venta: "Venta",
  ajuste: "Ajuste",
};

export function HistorialMovimientos({ movimientos }: { movimientos: Movimiento[] }) {
  if (movimientos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Este producto todavía no tiene movimientos.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {movimientos.map((m) => (
        <li key={m.id} className="flex items-start justify-between gap-3 p-3 text-sm">
          <div className="min-w-0 space-y-0.5">
            <div className="font-medium">{ETIQUETA[m.tipo]}</div>
            {m.motivo && <div className="break-words">{m.motivo}</div>}
            <div className="text-muted-foreground text-xs">
              {formatDateTime(m.createdAt)}
              {m.usuarioNombre ? ` · ${m.usuarioNombre}` : ""}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 font-semibold tabular-nums",
              m.cantidad > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
            )}
          >
            {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
          </span>
        </li>
      ))}
    </ul>
  );
}
