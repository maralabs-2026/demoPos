import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import {
  finDelDia,
  formatDate,
  formatDateTime,
  formatTime,
  inicioDelDia,
  sumarDias,
  todayISO,
} from "@/lib/date";
import { requireRol } from "@/modules/auth";
import {
  contarCajasAbiertas,
  getCierresEntre,
  resumenDelDia,
  totalesCierre,
} from "@/modules/caja";
import { DiferenciaBadge } from "@/modules/caja/components/diferencia-badge";
import { ImprimirBoton } from "@/modules/caja/components/imprimir-boton";
import { getCorteDiaComercial } from "@/modules/config";
import { fechaValida, getReporteVentas } from "@/modules/reportes";

export const dynamic = "force-dynamic";

// Cierre del día: junta los cierres de las cajas cerradas en un día comercial. Es una consulta,
// no un registro: no se "hace" ni cambia nada, y siempre coincide con el cierre de cada caja.
export default async function CierreDelDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const perfil = await requireRol("/caja/dia");
  const params = await searchParams;
  const corte = await getCorteDiaComercial();
  const corteHoras = corte.ok ? corte.data : 0;
  const hoy = todayISO(new Date(), corteHoras);
  const pedida = fechaValida(params.fecha) ?? hoy;
  const fecha = pedida > hoy ? hoy : pedida;
  const esHoy = fecha === hoy;

  const [cierres, reporte, abiertas] = await Promise.all([
    getCierresEntre(
      inicioDelDia(fecha, corteHoras),
      finDelDia(fecha, corteHoras),
    ),
    getReporteVentas({
      desde: fecha,
      hasta: fecha,
      agrupar: "dia",
      usuarioId: null,
    }),
    esHoy ? contarCajasAbiertas() : null,
  ]);

  const resumen = cierres.ok ? resumenDelDia(cierres.data) : null;
  const cajasAbiertas = abiertas?.ok ? abiertas.data : 0;
  const enlace = (f: string) => `/caja/dia?fecha=${f}`;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-3xl">Cierre del día</h1>
        <ImprimirBoton>Imprimí o guardá PDF</ImprimirBoton>
      </div>

      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <Button
          variant="outline"
          size="icon"
          nativeButton={false}
          render={<Link href={enlace(sumarDias(fecha, -1))} />}
          aria-label="Día anterior"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <form className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fecha" className="text-sm font-semibold">
              Día
            </label>
            <Input
              id="fecha"
              name="fecha"
              type="date"
              max={hoy}
              defaultValue={fecha}
            />
          </div>
          <Button type="submit" variant="outline">
            Mostrá
          </Button>
        </form>
        {!esHoy && (
          <Button
            variant="outline"
            size="icon"
            nativeButton={false}
            render={<Link href={enlace(sumarDias(fecha, 1))} />}
            aria-label="Día siguiente"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="reporte-print flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="hidden text-xl font-semibold print:block">
            Cierre del día
          </p>
          <p className="text-sm font-semibold">
            {formatDate(fecha)}
            {esHoy && " (hoy)"}
          </p>
          <p className="text-xs text-muted-foreground">
            Consultado el {formatDateTime(new Date().toISOString())} por{" "}
            {perfil.nombre}
          </p>
        </div>

        {esHoy && cajasAbiertas > 0 && (
          <p
            role="status"
            className="rounded-2xl border border-border bg-warning-soft px-4 py-3 text-sm text-warning-foreground print:hidden"
          >
            {cajasAbiertas === 1
              ? "Hay 1 caja abierta: "
              : `Hay ${cajasAbiertas} cajas abiertas: `}
            lo que se venda en ella entra en el día en que se cierre.
          </p>
        )}

        <Card className="gap-1 p-5">
          <CardEyebrow>Vendido en el día</CardEyebrow>
          {reporte.ok ? (
            <>
              <p className="text-3xl font-semibold tabular-nums">
                {formatCurrency(reporte.data.resumen.total)}
              </p>
              <p className="text-sm text-muted-foreground">
                {reporte.data.resumen.ventas === 1
                  ? "1 venta"
                  : `${reporte.data.resumen.ventas} ventas`}
                {reporte.data.resumen.anuladas > 0 &&
                  ` · ${reporte.data.resumen.anuladas} anuladas`}
              </p>
            </>
          ) : (
            <p className="text-sm text-destructive">{reporte.error}</p>
          )}
        </Card>

        {!cierres.ok && (
          <p className="text-sm text-destructive">{cierres.error}</p>
        )}

        {cierres.ok && resumen && cierres.data.length === 0 && (
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">
              No se cerró ninguna caja este día.
            </p>
          </Card>
        )}

        {cierres.ok && resumen && cierres.data.length > 0 && (
          <>
            <Card className="gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardEyebrow>Arqueo de las cajas cerradas</CardEyebrow>
                  <p className="text-sm text-muted-foreground">
                    {cierres.data.length === 1
                      ? "1 caja"
                      : `${cierres.data.length} cajas`}
                    {resumen.cajasConDiferencia > 0 &&
                      ` · ${resumen.cajasConDiferencia} con diferencia`}
                  </p>
                </div>
                <DiferenciaBadge diferencia={resumen.totales.diferencia} />
              </div>

              <ul
                aria-label="Arqueo por medio de pago"
                className="flex flex-col"
              >
                {resumen.medios.map((medio) => (
                  <li
                    key={medio.medioPagoId}
                    className="flex flex-col gap-1.5 border-b border-border py-3 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{medio.nombre}</p>
                      <DiferenciaBadge diferencia={medio.diferencia} />
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 text-sm text-muted-foreground tabular-nums">
                      <span>Esperado {formatCurrency(medio.esperado)}</span>
                      <span>Contado {formatCurrency(medio.contado)}</span>
                    </div>
                    {medio.cajasConDiferencia > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Con diferencia en{" "}
                        {medio.cajasConDiferencia === 1
                          ? "1 caja"
                          : `${medio.cajasConDiferencia} cajas`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-1 rounded-2xl border border-border bg-muted px-4 py-3 text-sm tabular-nums">
                <CardEyebrow>Total</CardEyebrow>
                <div className="flex justify-between gap-3">
                  <span>Esperado</span>
                  <span>{formatCurrency(resumen.totales.esperado)}</span>
                </div>
                <div className="flex justify-between gap-3 font-semibold">
                  <span>Contado</span>
                  <span>{formatCurrency(resumen.totales.contado)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                El esperado incluye el fondo inicial, los retiros y los ingresos
                de cada caja, así que no tiene por qué coincidir con lo vendido.
              </p>
            </Card>

            <Card className="gap-2 p-5">
              <CardEyebrow>Cajas del día</CardEyebrow>
              <ul aria-label="Cajas del día" className="flex flex-col">
                {cierres.data.map((caja) => {
                  const diferencia = totalesCierre(caja.lineas).diferencia;
                  return (
                    <li
                      key={caja.id}
                      className="border-b border-border last:border-0"
                    >
                      <Link
                        href={`/caja/historial/${caja.id}`}
                        className="flex items-center justify-between gap-3 py-3 hover:bg-muted"
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-semibold break-words">
                            {caja.titular}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {horario(caja.abiertaAt, caja.cerradaAt)}
                            {caja.cerradaPor &&
                              caja.cerradaPor !== caja.titular &&
                              ` · cerró ${caja.cerradaPor}`}
                          </span>
                        </span>
                        {caja.lineas.length === 0 ? (
                          <Badge>Sin conteo</Badge>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1">
                            <DiferenciaBadge diferencia={diferencia} />
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4 text-muted-foreground print:hidden"
                            />
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

// "14:00 a 22:30"; si abrió otro día, con la fecha completa.
function horario(abiertaAt: string, cerradaAt: string): string {
  const mismoDia =
    formatDateTime(abiertaAt).slice(0, 10) ===
    formatDateTime(cerradaAt).slice(0, 10);
  const desde = mismoDia ? formatTime(abiertaAt) : formatDateTime(abiertaAt);
  return `${desde} a ${formatTime(cerradaAt)}`;
}
