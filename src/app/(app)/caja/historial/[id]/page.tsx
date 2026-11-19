import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { canAccess, requireRol } from "@/modules/auth";
import {
  desgloseCierre,
  getCajaCerrada,
  getMovimientosCaja,
  getVentasCaja,
  totalesCierre,
  type MovimientoCaja,
} from "@/modules/caja";
import { DetalleMedio } from "@/modules/caja/components/detalle-medio";
import { DiferenciaBadge } from "@/modules/caja/components/diferencia-badge";
import { MovimientosLista } from "@/modules/caja/components/movimientos-lista";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// En centavos, como el resto del cierre.
function sumarMovimientos(
  movimientos: MovimientoCaja[],
  tipo: MovimientoCaja["tipo"],
): number {
  return (
    movimientos
      .filter((m) => m.tipo === tipo)
      .reduce((acc, m) => acc + Math.round(m.monto * 100), 0) / 100
  );
}

// Resultado de un cierre: acá se ve el esperado y la diferencia.
export default async function CierreCajaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await requireRol("/caja/historial");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [result, movimientos, ventas] = await Promise.all([
    getCajaCerrada(id),
    getMovimientosCaja(id),
    getVentasCaja(id),
  ]);
  if (result.ok && !result.data) notFound();
  if (!result.ok || !result.data) {
    return (
      <main className="p-6">
        <p className="text-sm text-destructive">
          {result.ok ? "No se encontró el cierre." : result.error}
        </p>
      </main>
    );
  }

  const caja = result.data;
  const totales = totalesCierre(caja.lineas);
  const verVenta = canAccess(perfil.rol, "/reportes/ventas");
  // Sin ventas o sin movimientos no se puede rearmar el esperado: se muestra solo el cierre.
  const desglose =
    ventas.ok && movimientos.ok
      ? desgloseCierre(caja.lineas, ventas.data, {
          cerradaAt: caja.cerradaAt,
          fondo: caja.montoInicial,
          ingresos: sumarMovimientos(movimientos.data, "ingreso"),
          retiros: sumarMovimientos(movimientos.data, "retiro"),
        })
      : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Caja cerrada</h1>

      <Card className="gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1 text-sm">
            <p className="font-semibold">{caja.titular}</p>
            <p className="text-muted-foreground">
              Abierta el {formatDateTime(caja.abiertaAt)}
            </p>
            <p className="text-muted-foreground">
              Cerrada el {formatDateTime(caja.cerradaAt)}
              {caja.cerradaPor ? ` por ${caja.cerradaPor}` : ""}
            </p>
            <p className="text-muted-foreground tabular-nums">
              Fondo inicial {formatCurrency(caja.montoInicial)}
            </p>
          </div>
          {caja.lineas.length > 0 && (
            <DiferenciaBadge diferencia={totales.diferencia} />
          )}
        </div>

        {caja.lineas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta caja se cerró sin conteo, antes de que existiera el arqueo.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Tocá un medio para ver las ventas que forman su esperado.
            </p>
            <ul className="flex flex-col">
              {caja.lineas.map((linea) => (
                <DetalleMedio
                  key={linea.medioPagoId}
                  linea={linea}
                  desglose={desglose?.get(linea.medioPagoId)}
                  verVenta={verVenta}
                />
              ))}
            </ul>
            {!ventas.ok && (
              <p className="text-sm text-destructive">{ventas.error}</p>
            )}
          </>
        )}

        {caja.lineas.length > 0 && (
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-muted px-4 py-3 text-sm tabular-nums">
            <CardEyebrow>Total</CardEyebrow>
            <div className="flex justify-between gap-3">
              <span>Esperado</span>
              <span>{formatCurrency(totales.esperado)}</span>
            </div>
            <div className="flex justify-between gap-3 font-semibold">
              <span>Contado</span>
              <span>{formatCurrency(totales.contado)}</span>
            </div>
          </div>
        )}

        {!movimientos.ok && (
          <p className="text-sm text-destructive">{movimientos.error}</p>
        )}
        {movimientos.ok && movimientos.data.length > 0 && (
          <div className="flex flex-col gap-1">
            <CardEyebrow>Retiros e ingresos</CardEyebrow>
            <MovimientosLista movimientos={movimientos.data} />
          </div>
        )}

        {caja.nota && (
          <div className="flex flex-col gap-1">
            <CardEyebrow>Nota</CardEyebrow>
            <p className="text-sm break-words">{caja.nota}</p>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          nativeButton={false}
          render={<Link href="/vender" />}
        >
          Andá a vender
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/caja/historial" />}
        >
          Ver el historial
        </Button>
      </div>
    </main>
  );
}
