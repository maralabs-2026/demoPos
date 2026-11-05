import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, sumarDias, todayISO } from "@/lib/date";
import { requireRol } from "@/modules/auth";
import { fechaValida } from "@/modules/reportes";
import { getVentas } from "@/modules/ventas";

export const dynamic = "force-dynamic";

export default async function HistorialVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; pagina?: string }>;
}) {
  await requireRol("/reportes/ventas");

  const params = await searchParams;
  const hoy = todayISO();
  const desde = fechaValida(params.desde) ?? sumarDias(hoy, -6);
  const hasta = fechaValida(params.hasta) ?? hoy;
  const pagina = Math.max(0, Math.floor(Number(params.pagina)) || 0);
  const result = await getVentas({ desde, hasta, pagina });

  const enlace = (n: number) =>
    `/reportes/ventas?desde=${desde}&hasta=${hasta}&pagina=${n}`;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Historial de ventas</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="desde" className="text-sm font-semibold">
            Desde
          </label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hasta" className="text-sm font-semibold">
            Hasta
          </label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} />
        </div>
        <Button type="submit" variant="outline">
          Filtrá
        </Button>
      </form>

      {!result.ok && <p className="text-sm text-destructive">{result.error}</p>}

      {result.ok && result.data.ventas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay ventas en este período.
        </p>
      )}

      {result.ok && result.data.ventas.length > 0 && (
        <ul aria-label="Ventas" className="flex flex-col gap-2">
          {result.data.ventas.map((venta) => (
            <li key={venta.id}>
              <Link
                href={`/reportes/ventas/${venta.id}`}
                className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Card className="flex-row items-center justify-between gap-3 p-4 transition-colors hover:border-input">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-semibold">
                      {formatDateTime(venta.fecha)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {venta.cajero} · {venta.medios}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    {venta.estado === "anulada" && (
                      <Badge variant="destructive">Anulada</Badge>
                    )}
                    <span
                      className={
                        venta.estado === "anulada"
                          ? "text-sm font-semibold text-muted-foreground tabular-nums line-through"
                          : "text-sm font-semibold tabular-nums"
                      }
                    >
                      {formatCurrency(venta.total)}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.ok && (pagina > 0 || result.data.hayMas) && (
        <div className="flex justify-between gap-2">
          {pagina > 0 ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={enlace(pagina - 1)} />}
            >
              Más nuevas
            </Button>
          ) : (
            <span />
          )}
          {result.data.hayMas && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={enlace(pagina + 1)} />}
            >
              Más viejas
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
