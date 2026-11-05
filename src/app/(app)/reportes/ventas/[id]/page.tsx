import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardEyebrow } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { requireRol } from "@/modules/auth";
import { getTicketConfig } from "@/modules/config";
import { getVenta, numeroTicket } from "@/modules/ventas";
import { AnularVenta } from "@/modules/ventas/components/anular-venta";
import { TicketControles } from "@/modules/ventas/components/ticket-controles";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRol("/reportes/ventas");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [result, ticket] = await Promise.all([getVenta(id), getTicketConfig()]);
  if (result.ok && !result.data) notFound();
  if (!result.ok || !result.data) {
    return (
      <main className="p-6">
        <p className="text-sm text-destructive">
          {result.ok ? "No se encontró la venta." : result.error}
        </p>
      </main>
    );
  }

  const { comprobante: venta, estado, cajero, anulacion } = result.data;
  const textos = ticket.ok ? ticket.data : { titulo: "", leyenda: "", pie: "" };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl print:hidden">
        Venta {numeroTicket(venta.ventaId)}
      </h1>

      <Card className="gap-4 p-5 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1 text-sm">
            <p className="font-semibold">{formatDateTime(venta.fecha)}</p>
            <p className="text-muted-foreground">
              {cajero} · {venta.medioPagoNombre}
            </p>
          </div>
          {estado === "anulada" && <Badge variant="destructive">Anulada</Badge>}
        </div>

        <ul aria-label="Ítems de la venta" className="flex flex-col text-sm">
          {venta.items.map((item, i) => (
            <li
              key={i}
              className="flex justify-between gap-3 border-b border-border py-2.5 last:border-0"
            >
              <span className="min-w-0 break-words">
                {item.cantidad} × {item.nombre}
                {item.promocion && (
                  <span className="block text-xs font-semibold text-success-text">
                    Promo: {item.promocion}
                  </span>
                )}
                {item.descuento > 0 && (
                  <span className="block text-xs text-success-text">
                    Descuento − {formatCurrency(item.descuento)}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatCurrency(item.subtotal)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-muted px-4 py-3 text-sm tabular-nums">
          {venta.descuentoTotal > 0 && (
            <div className="flex justify-between gap-3">
              <span>Descuento sobre el total</span>
              <span>− {formatCurrency(venta.descuentoTotal)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(venta.total)}</span>
          </div>
        </div>

        {anulacion && (
          <div className="flex flex-col gap-1">
            <CardEyebrow>Anulación</CardEyebrow>
            <p className="text-sm break-words">{anulacion.motivo}</p>
            <p className="text-xs text-muted-foreground">
              {anulacion.por} · {formatDateTime(anulacion.fecha)}
            </p>
          </div>
        )}
      </Card>

      {estado === "completada" && (
        <>
          <TicketControles venta={venta} textos={textos} />
          <AnularVenta ventaId={venta.ventaId} />
        </>
      )}
    </main>
  );
}
