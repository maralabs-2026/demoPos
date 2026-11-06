import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { formatDate, sumarDias, todayISO } from "@/lib/date";
import { requireRol } from "@/modules/auth";
import {
  filtrosDesdeParams,
  gananciaNeta,
  getCajeros,
  getReporteVentas,
  sinCostosCargados,
  type Agrupacion,
} from "@/modules/reportes";
import { getCorteDiaComercial } from "@/modules/config";

export const dynamic = "force-dynamic";

const PERIODO_LABEL: Record<Agrupacion, (fecha: string) => string> = {
  dia: formatDate,
  semana: (fecha) => `Semana del ${formatDate(fecha)}`,
  mes: (fecha) => formatDate(fecha).slice(3),
};

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card className="gap-1 p-4">
      <CardEyebrow>{titulo}</CardEyebrow>
      <p className="text-xl font-bold tracking-tight tabular-nums">{valor}</p>
    </Card>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    agrupar?: string;
    cajero?: string;
  }>;
}) {
  await requireRol("/reportes");

  // "Hoy" es el día comercial: con hora de corte, la madrugada cuenta para el día anterior.
  const corte = await getCorteDiaComercial();
  const hoy = todayISO(new Date(), corte.ok ? corte.data : 0);
  const filtros = filtrosDesdeParams(await searchParams, hoy);
  const [reporte, cajeros] = await Promise.all([
    getReporteVentas(filtros),
    getCajeros(),
  ]);

  const sinCostos = reporte.ok && sinCostosCargados(reporte.data.resumen);
  const neta = reporte.ok ? gananciaNeta(reporte.data.resumen) : null;

  const consulta = new URLSearchParams({
    desde: filtros.desde,
    hasta: filtros.hasta,
    agrupar: filtros.agrupar,
    ...(filtros.usuarioId ? { cajero: filtros.usuarioId } : {}),
  });
  const atajos = [
    { label: "Hoy", desde: hoy, agrupar: "dia" },
    { label: "7 días", desde: sumarDias(hoy, -6), agrupar: "dia" },
    { label: "30 días", desde: sumarDias(hoy, -29), agrupar: "semana" },
    { label: "Este mes", desde: `${hoy.slice(0, 8)}01`, agrupar: "dia" },
  ];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Reportes</h1>

      <div className="flex flex-wrap gap-2">
        {atajos.map((a) => (
          <Button
            key={a.label}
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`/reportes?desde=${a.desde}&hasta=${hoy}&agrupar=${a.agrupar}`}
              />
            }
          >
            {a.label}
          </Button>
        ))}
      </div>

      <form className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="desde" className="text-sm font-semibold">
            Desde
          </label>
          <Input
            id="desde"
            name="desde"
            type="date"
            defaultValue={filtros.desde}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="hasta" className="text-sm font-semibold">
            Hasta
          </label>
          <Input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={filtros.hasta}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="agrupar" className="text-sm font-semibold">
            Agrupar por
          </label>
          <select
            id="agrupar"
            name="agrupar"
            defaultValue={filtros.agrupar}
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="cajero" className="text-sm font-semibold">
            Cajero
          </label>
          <select
            id="cajero"
            name="cajero"
            defaultValue={filtros.usuarioId ?? ""}
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="">Todos</option>
            {cajeros.ok &&
              cajeros.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </div>
        <Button type="submit" className="col-span-2 sm:col-span-1">
          Filtrá
        </Button>
      </form>

      {!reporte.ok && (
        <p className="text-sm text-destructive">{reporte.error}</p>
      )}

      {reporte.ok && (
        <>
          <section
            aria-label="Resumen"
            className="grid grid-cols-2 gap-3 lg:grid-cols-3"
          >
            <Dato
              titulo="Vendido"
              valor={formatCurrency(reporte.data.resumen.total)}
            />
            <Dato titulo="Ventas" valor={String(reporte.data.resumen.ventas)} />
            <Dato
              titulo="Ganancia estimada"
              valor={
                sinCostos
                  ? "Sin costos"
                  : formatCurrency(reporte.data.resumen.ganancia)
              }
            />
            {/* Los gastos son del comercio: no se reparten por cajero. */}
            {!filtros.usuarioId && (
              <>
                <Dato
                  titulo="Gastos pagados"
                  valor={formatCurrency(reporte.data.resumen.gastosPagados)}
                />
                <Dato
                  titulo="Ganancia neta"
                  valor={neta === null ? "Sin costos" : formatCurrency(neta)}
                />
              </>
            )}
            <Dato
              titulo="Descuentos"
              valor={formatCurrency(reporte.data.resumen.descuentos)}
            />
          </section>

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {reporte.data.resumen.sinCosto > 0 && (
              <p>
                {formatCurrency(reporte.data.resumen.sinCosto)} vendidos sin
                costo cargado: no entran en la ganancia estimada.
              </p>
            )}
            {reporte.data.resumen.anuladas > 0 && (
              <p>
                No cuenta {reporte.data.resumen.anuladas}{" "}
                {reporte.data.resumen.anuladas === 1
                  ? "venta anulada"
                  : "ventas anuladas"}{" "}
                por {formatCurrency(reporte.data.resumen.totalAnulado)}.
              </p>
            )}
            <p>
              Cada venta cuenta el día en que se hizo: una caja que queda
              abierta de un día para otro no va a coincidir con el reporte de un
              solo día.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-1 p-5">
              <h2 className="font-display text-lg font-bold">Por período</h2>
              {reporte.data.periodos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay ventas en este período.
                </p>
              ) : (
                <ul aria-label="Ventas por período" className="flex flex-col">
                  {reporte.data.periodos.map((p) => (
                    <li
                      key={p.periodo}
                      className="flex justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {PERIODO_LABEL[filtros.agrupar](p.periodo)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.ventas} {p.ventas === 1 ? "venta" : "ventas"}
                          {!sinCostos &&
                            ` · Ganancia ${formatCurrency(p.ganancia)}`}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatCurrency(p.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-1 p-5">
              <h2 className="font-display text-lg font-bold">
                Productos más vendidos
              </h2>
              {reporte.data.ranking.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay ventas en este período.
                </p>
              ) : (
                <ol aria-label="Ranking de productos" className="flex flex-col">
                  {reporte.data.ranking.map((p, i) => (
                    <li
                      key={p.productoId}
                      className="flex justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                    >
                      <span className="min-w-0 break-words">
                        <span className="text-muted-foreground">{i + 1}. </span>
                        <span className="font-semibold">{p.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.cantidad}{" "}
                          {p.cantidad === 1 ? "unidad" : "unidades"}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatCurrency(p.total)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card className="gap-1 p-5">
              <h2 className="font-display text-lg font-bold">Por cajero</h2>
              {reporte.data.porCajero.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay ventas en este período.
                </p>
              ) : (
                <ul aria-label="Ventas por cajero" className="flex flex-col">
                  {reporte.data.porCajero.map((c) => (
                    <li
                      key={c.usuarioId}
                      className="flex justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold break-words">
                          {c.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {c.ventas} {c.ventas === 1 ? "venta" : "ventas"}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatCurrency(c.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-1 p-5">
              <h2 className="font-display text-lg font-bold">
                Por medio de pago
              </h2>
              {reporte.data.porMedio.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay ventas en este período.
                </p>
              ) : (
                <ul
                  aria-label="Ventas por medio de pago"
                  className="flex flex-col"
                >
                  {reporte.data.porMedio.map((m) => (
                    <li
                      key={m.nombre}
                      className="flex justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                    >
                      <span className="min-w-0 font-semibold break-words">
                        {m.nombre}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatCurrency(m.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Enlaces comunes: es una descarga, no una navegación de la app. */}
        <a
          href={`/reportes/exportar?tipo=ventas&${consulta}`}
          className="flex h-10 items-center gap-2 rounded-full border border-input px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Download aria-hidden="true" className="size-4" />
          Exportá las ventas
        </a>
        <a
          href="/reportes/exportar?tipo=stock"
          className="flex h-10 items-center gap-2 rounded-full border border-input px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Download aria-hidden="true" className="size-4" />
          Exportá el stock
        </a>
      </div>
    </main>
  );
}
