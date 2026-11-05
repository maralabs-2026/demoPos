import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { formatDate, formatDateTime, todayISO } from "@/lib/date";
import { requireRol } from "@/modules/auth";
import { estaVencido } from "@/modules/caja";
import { DiferenciaBadge } from "@/modules/caja/components/diferencia-badge";
import {
  gananciaNeta,
  getInicio,
  sinCostosCargados,
  type Inicio,
  type TipoActividad,
} from "@/modules/reportes";

export const dynamic = "force-dynamic";

const ACTIVIDAD: Record<TipoActividad, string> = {
  anulacion: "Venta anulada",
  cierre: "Caja cerrada",
  retiro: "Retiro",
  ingreso: "Ingreso",
  gasto: "Gasto pagado",
};

function enlaceActividad(a: Inicio["actividad"][number]): string | null {
  if (a.tipo === "anulacion") return `/reportes/ventas/${a.ref}`;
  if (a.tipo === "cierre") return `/caja/historial/${a.ref}`;
  if (a.tipo === "gasto") return "/caja/gastos";
  return null;
}

function Pendiente({
  href,
  titulo,
  detalle,
  destacado,
}: {
  href: string;
  titulo: string;
  detalle?: string;
  destacado?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="block font-semibold break-words">{titulo}</span>
          {detalle && (
            <span className="text-xs text-muted-foreground">{detalle}</span>
          )}
        </span>
        <span className="shrink-0">{destacado}</span>
      </Link>
    </li>
  );
}

export default async function InicioPage() {
  const profile = await requireRol("/inicio");
  const result = await getInicio();

  if (!result.ok) {
    return (
      <main className="p-6">
        <p className="text-sm text-destructive">{result.error}</p>
      </main>
    );
  }

  const inicio = result.data;
  const hoy = todayISO();
  const efectivo = inicio.cajas.reduce(
    (acc, c) => acc + Math.round(c.efectivo * 100),
    0,
  );
  const neta = gananciaNeta(inicio.mes);
  const sinPendientes =
    inicio.reposicion === 0 &&
    inicio.cajasConDiferencia.length === 0 &&
    inicio.gastos.length === 0;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Hola, {profile.nombre}</h1>
        <Button
          variant="success"
          nativeButton={false}
          render={<Link href="/vender" />}
        >
          <Store data-icon="inline-start" />
          Andá a vender
        </Button>
      </div>

      <section aria-label="Resumen" className="grid gap-3 sm:grid-cols-3">
        <Card className="gap-1 p-4">
          <CardEyebrow>Vendido hoy</CardEyebrow>
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {formatCurrency(inicio.hoy.total)}
          </p>
          <p className="text-xs text-muted-foreground">
            {inicio.hoy.ventas} {inicio.hoy.ventas === 1 ? "venta" : "ventas"}
          </p>
        </Card>
        <Card className="gap-1 p-4">
          <CardEyebrow>Efectivo en caja</CardEyebrow>
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {formatCurrency(efectivo / 100)}
          </p>
          <p className="text-xs text-muted-foreground">
            {inicio.cajas.length === 0
              ? "No hay cajas abiertas para mostrar."
              : inicio.cajas
                  .map((c) => `${c.titular}: ${formatCurrency(c.efectivo)}`)
                  .join(" · ")}
          </p>
          {inicio.cajaPropiaOculta && (
            <p className="text-xs text-muted-foreground">
              No incluye tu caja: la contás a ciegas al cerrar.
            </p>
          )}
        </Card>
        <Card className="gap-1 p-4">
          <CardEyebrow>Ganancia neta del mes</CardEyebrow>
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {neta === null ? "Sin costos" : formatCurrency(neta)}
          </p>
          <p className="text-xs text-muted-foreground">
            {sinCostosCargados(inicio.mes)
              ? "Cargá los costos de tus productos para calcularla."
              : `Ganancia ${formatCurrency(inicio.mes.ganancia)} − gastos ${formatCurrency(inicio.mes.gastosPagados)}`}
          </p>
          {!sinCostosCargados(inicio.mes) && inicio.mes.sinCosto > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(inicio.mes.sinCosto)} vendidos sin costo cargado
              no entran.
            </p>
          )}
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-1 p-5">
          <h2 className="font-display text-lg font-bold">Pendientes</h2>
          {sinPendientes ? (
            <p className="text-sm text-muted-foreground">
              No tenés nada pendiente.
            </p>
          ) : (
            <ul aria-label="Pendientes" className="flex flex-col">
              {inicio.reposicion > 0 && (
                <Pendiente
                  href="/stock/reposicion"
                  titulo={`${inicio.reposicion} ${inicio.reposicion === 1 ? "producto" : "productos"} para reponer`}
                  detalle="Bajo el mínimo"
                />
              )}
              {inicio.cajasConDiferencia.map((c) => (
                <Pendiente
                  key={c.cajaId}
                  href={`/caja/historial/${c.cajaId}`}
                  titulo={`Caja de ${c.titular} con diferencia`}
                  detalle={`Cerrada el ${formatDateTime(c.cerradaAt)}`}
                  destacado={<DiferenciaBadge diferencia={c.diferencia} />}
                />
              ))}
              {inicio.gastos.map((g) => (
                <Pendiente
                  key={g.id}
                  href="/caja/gastos"
                  titulo={g.descripcion}
                  detalle={`${estaVencido(g.vencimiento, hoy) ? "Venció" : "Vence"} el ${formatDate(g.vencimiento)}`}
                  destacado={
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(g.monto)}
                    </span>
                  }
                />
              ))}
            </ul>
          )}
        </Card>

        <Card className="gap-1 p-5">
          <h2 className="font-display text-lg font-bold">Actividad reciente</h2>
          {inicio.actividad.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay actividad.
            </p>
          ) : (
            <ul aria-label="Actividad reciente" className="flex flex-col">
              {inicio.actividad.map((a, i) => {
                const contenido = (
                  <>
                    <span className="min-w-0">
                      <span className="block font-semibold break-words">
                        {ACTIVIDAD[a.tipo]}
                        {a.detalle ? `: ${a.detalle}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.usuario} · {formatDateTime(a.fecha)}
                      </span>
                    </span>
                    {a.monto !== null && (
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatCurrency(a.monto)}
                      </span>
                    )}
                  </>
                );
                const enlace = enlaceActividad(a);
                const clase =
                  "flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm";
                return (
                  <li key={i}>
                    {enlace ? (
                      <Link
                        href={enlace}
                        className={`${clase} hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
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
        </Card>
      </div>
    </main>
  );
}
