import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import type { MovimientoCaja } from "../queries";

export function MovimientosLista({
  movimientos,
}: {
  movimientos: MovimientoCaja[];
}) {
  return (
    <ul className="flex flex-col" aria-label="Retiros e ingresos">
      {movimientos.map((movimiento) => (
        <li
          key={movimiento.id}
          className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-0"
        >
          <div className="flex min-w-0 flex-col gap-0.5 text-sm">
            <p className="font-semibold break-words">{movimiento.motivo}</p>
            <p className="text-xs text-muted-foreground">
              {movimiento.esAjuste
                ? "Ajuste"
                : movimiento.tipo === "retiro"
                  ? "Retiro"
                  : "Ingreso"}{" "}
              · {movimiento.autor}
              {movimiento.autorizadoPor &&
                ` · autorizó ${movimiento.autorizadoPor}`}{" "}
              · {formatDateTime(movimiento.createdAt)}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {movimiento.tipo === "retiro" ? "− " : "+ "}
            {formatCurrency(movimiento.monto)}
          </p>
        </li>
      ))}
    </ul>
  );
}
