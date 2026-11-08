import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { formatDateTime, sumarDias, todayISO } from "@/lib/date";
import { requireRol } from "@/modules/auth";
import { getCorteDiaComercial } from "@/modules/config";
import {
  anchoBarra,
  filtrosDesdeParams,
  getReporteAnalisis,
  horasContinuas,
  margenCategoria,
  semanaCompleta,
} from "@/modules/reportes";

export const dynamic = "force-dynamic";

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function Barras({
  etiqueta,
  filas,
}: {
  etiqueta: string;
  filas: { clave: string; ventas: number; total: number }[];
}) {
  const maximo = Math.max(...filas.map((f) => f.total), 0);
  return (
    <ul aria-label={etiqueta} className="flex flex-col gap-1.5">
      {filas.map((f) => (
        <li
          key={f.clave}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm"
        >
          <span className="text-muted-foreground">{f.clave}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${anchoBarra(f.total, maximo)}%` }}
            />
          </span>
          <span className="text-xs whitespace-nowrap tabular-nums">
            {formatCurrency(f.total)} · {f.ventas}{" "}
            {f.ventas === 1 ? "venta" : "ventas"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireRol("/reportes/analisis");

  const corte = await getCorteDiaComercial();
  const hoy = todayISO(new Date(), corte.ok ? corte.data : 0);
  const params = await searchParams;
  // Por defecto, 30 días: con un solo día casi todo aparecería sin movimiento.
  const { desde, hasta } = filtrosDesdeParams(
    { desde: params.desde ?? sumarDias(hoy, -29), hasta: params.hasta ?? hoy },
    hoy,
  );
  const reporte = await getReporteAnalisis(desde, hasta);

  const atajos = [
    { label: "7 días", desde: sumarDias(hoy, -6) },
    { label: "30 días", desde: sumarDias(hoy, -29) },
    { label: "90 días", desde: sumarDias(hoy, -89) },
    { label: "Este mes", desde: `${hoy.slice(0, 8)}01` },
  ];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Análisis</h1>

      <div className="flex flex-wrap gap-2">
        {atajos.map((a) => (
          <Button
            key={a.label}
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/reportes/analisis?desde=${a.desde}&hasta=${hoy}`} />
            }
          >
            {a.label}
          </Button>
        ))}
      </div>

      <form className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="desde" className="text-sm font-semibold">
            Desde
          </label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="hasta" className="text-sm font-semibold">
            Hasta
          </label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} />
        </div>
        <Button type="submit" variant="outline" size="lg">
          Aplicá
        </Button>
      </form>

      {!reporte.ok && (
        <p className="text-sm text-destructive">{reporte.error}</p>
      )}

      {reporte.ok && (
        <>
          <Card className="gap-3 p-5">
            <h2 className="font-display text-lg font-bold">
              Margen por categoría
            </h2>
            {reporte.data.categorias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hubo ventas en este período.
              </p>
            ) : (
              <ul aria-label="Margen por categoría" className="flex flex-col">
                {reporte.data.categorias.map((c) => (
                  <li
                    key={c.categoria}
                    className="flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold break-words">
                        {c.categoria}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Vendido {formatCurrency(c.total)}
                        {c.sinCosto > 0 &&
                          ` · ${formatCurrency(c.sinCosto)} sin costo cargado`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block font-semibold">
                        {formatCurrency(c.ganancia)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Margen{" "}
                        {formatPercent(
                          margenCategoria(c.ganancia, c.totalConCosto),
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-3 p-5">
              <h2 className="font-display text-lg font-bold">Por hora</h2>
              {reporte.data.porHora.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ventas.</p>
              ) : (
                <Barras
                  etiqueta="Ventas por hora"
                  filas={horasContinuas(reporte.data.porHora).map((h) => ({
                    clave: `${String(h.hora).padStart(2, "0")}:00`,
                    ventas: h.ventas,
                    total: h.total,
                  }))}
                />
              )}
            </Card>
            <Card className="gap-3 p-5">
              <h2 className="font-display text-lg font-bold">
                Por día de la semana
              </h2>
              {reporte.data.porDia.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ventas.</p>
              ) : (
                <Barras
                  etiqueta="Ventas por día de la semana"
                  filas={semanaCompleta(reporte.data.porDia).map((d) => ({
                    clave: DIAS[d.dia],
                    ventas: d.ventas,
                    total: d.total,
                  }))}
                />
              )}
            </Card>
          </div>

          <Card className="gap-3 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-lg font-bold">
                Productos sin movimiento
              </h2>
              <p className="text-xs text-muted-foreground">
                Con stock y sin ventas en este período
                {reporte.data.sinMovimientoTotal >
                  reporte.data.sinMovimiento.length &&
                  `. Se muestran ${reporte.data.sinMovimiento.length} de ${reporte.data.sinMovimientoTotal}`}
                .
              </p>
            </div>
            {reporte.data.sinMovimiento.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todos los productos con stock se vendieron.
              </p>
            ) : (
              <ul
                aria-label="Productos sin movimiento"
                className="flex flex-col"
              >
                {reporte.data.sinMovimiento.map((s) => (
                  <li
                    key={s.productoId}
                    className="flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold break-words">
                        {s.nombre}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.stockActual} {s.unidadVenta} ·{" "}
                        {s.ultimaVenta
                          ? `Última venta ${formatDateTime(s.ultimaVenta)}`
                          : "Nunca se vendió"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-semibold tabular-nums">
                      {s.inmovilizado === null
                        ? "Sin costo"
                        : formatCurrency(s.inmovilizado)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
