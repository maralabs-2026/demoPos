import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { DesgloseMedio, LineaCierre } from "../cierre";
import { DiferenciaBadge } from "./diferencia-badge";

// Una línea del cierre que se despliega para mostrar qué forma su esperado: las ventas cobradas
// con ese medio y, en el efectivo, el fondo, los ingresos y los retiros. Sirve para cruzar una
// diferencia con los cupones del posnet, las transferencias o el cajón.
export function DetalleMedio({
  linea,
  desglose,
  verVenta,
}: {
  linea: LineaCierre;
  desglose: DesgloseMedio | undefined;
  // Si quien mira puede abrir el detalle de una venta (dueño y encargado).
  verVenta: boolean;
}) {
  const ventas = desglose?.ventas ?? [];
  const contadas = ventas.filter((v) => v.anulada !== "antes").length;

  return (
    <li className="border-b border-border last:border-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-1.5 py-3 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
              {linea.nombre}
            </p>
            <DiferenciaBadge diferencia={linea.diferencia} />
          </div>
          <div className="flex justify-between gap-3 text-sm text-muted-foreground tabular-nums">
            <span>Esperado {formatCurrency(linea.esperado)}</span>
            <span>Contado {formatCurrency(linea.contado)}</span>
          </div>
        </summary>

        {desglose && (
          <div className="flex flex-col gap-3 pb-4 pl-5.5">
            <dl
              aria-label={`Cómo se armó el esperado de ${linea.nombre}`}
              className="flex flex-col gap-1 rounded-2xl border border-border bg-muted px-4 py-3 text-sm tabular-nums"
            >
              {desglose.caja && (
                <Fila etiqueta="Fondo inicial" valor={desglose.caja.fondo} />
              )}
              <Fila
                etiqueta={`Ventas (${contadas})`}
                valor={desglose.totalVentas}
                signo={desglose.caja ? "+" : undefined}
              />
              {desglose.caja && desglose.caja.ingresos > 0 && (
                <Fila
                  etiqueta="Ingresos"
                  valor={desglose.caja.ingresos}
                  signo="+"
                />
              )}
              {desglose.caja && desglose.caja.retiros > 0 && (
                <Fila
                  etiqueta="Retiros"
                  valor={desglose.caja.retiros}
                  signo="−"
                />
              )}
              {desglose.sinDetalle !== 0 && (
                <Fila etiqueta="Sin detalle" valor={desglose.sinDetalle} />
              )}
              <div className="flex justify-between gap-3 border-t border-border pt-1 font-semibold">
                <dt>Esperado</dt>
                <dd>{formatCurrency(linea.esperado)}</dd>
              </div>
            </dl>

            {ventas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hubo ventas con este medio.
              </p>
            ) : (
              <ul
                aria-label={`Ventas de ${linea.nombre}`}
                className="flex flex-col"
              >
                {ventas.map((venta) => {
                  const contenido = (
                    <>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium tabular-nums">
                          {formatTime(venta.createdAt)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {venta.cajero}
                          {venta.combinado && " · pago combinado"}
                          {venta.anulada === "antes" && " · anulada, no suma"}
                          {venta.anulada === "despues" &&
                            " · anulada después del cierre"}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-semibold tabular-nums",
                          venta.anulada === "antes" &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {formatCurrency(venta.monto)}
                      </span>
                    </>
                  );
                  const clase =
                    "flex items-start justify-between gap-3 py-2 text-sm";
                  return (
                    <li
                      key={venta.id}
                      className="border-b border-border last:border-0"
                    >
                      {verVenta ? (
                        <Link
                          href={`/reportes/ventas/${venta.id}`}
                          className={cn(clase, "hover:bg-muted")}
                        >
                          {contenido}
                        </Link>
                      ) : (
                        <div className={clase}>{contenido}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </details>
    </li>
  );
}

function Fila({
  etiqueta,
  valor,
  signo,
}: {
  etiqueta: string;
  valor: number;
  signo?: "+" | "−";
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{etiqueta}</dt>
      <dd>
        {signo ? `${signo} ` : ""}
        {formatCurrency(valor)}
      </dd>
    </div>
  );
}
