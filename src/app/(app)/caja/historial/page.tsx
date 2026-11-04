import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireRol } from "@/modules/auth";
import { getHistorialCajas, totalesCierre } from "@/modules/caja";
import { DiferenciaBadge } from "@/modules/caja/components/diferencia-badge";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function HistorialCajasPage() {
  await requireRol("/caja/historial");
  const result = await getHistorialCajas();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Historial de cajas</h1>

      {!result.ok && <p className="text-sm text-destructive">{result.error}</p>}

      {result.ok && result.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay cajas cerradas.
        </p>
      )}

      {result.ok && result.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {result.data.map((caja) => {
            const totales = totalesCierre(caja.lineas);
            return (
              <li key={caja.id}>
                <Link
                  href={`/caja/historial/${caja.id}`}
                  className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Card className="flex-row items-center justify-between gap-3 p-4 transition-colors hover:border-input">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate text-sm font-semibold">
                        {caja.titular}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cerrada el {formatDateTime(caja.cerradaAt)}
                      </p>
                      {/* Cajas sin conteo: quedaron cerradas antes de la Fase 5. */}
                      {caja.lineas.length > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Contado {formatCurrency(totales.contado)}
                        </p>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {caja.lineas.length > 0 && (
                        <DiferenciaBadge diferencia={totales.diferencia} />
                      )}
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                    </span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
