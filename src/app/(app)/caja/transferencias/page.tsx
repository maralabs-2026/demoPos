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
import { cn } from "@/lib/utils";
import { requireRol } from "@/modules/auth";
import {
  estadoTransferencia,
  getTransferencias,
  resumenTransferencias,
  type EstadoTransferencia,
} from "@/modules/caja";
import { VerificarTransferencia } from "@/modules/caja/components/verificar-transferencia";
import { getCorteDiaComercial } from "@/modules/config";
import { fechaValida } from "@/modules/reportes";

export const dynamic = "force-dynamic";

const ETIQUETA: Record<
  EstadoTransferencia,
  { texto: string; variant: "success" | "destructive" | "warning" }
> = {
  llego: { texto: "Llegó", variant: "success" },
  no_llego: { texto: "No llegó", variant: "destructive" },
  pendiente: { texto: "Sin verificar", variant: "warning" },
};

// Control de transferencias: el dueño o el encargado miran la cuenta y marcan, pago por pago, si
// la plata llegó. No cambia la venta ni la caja: es una constancia.
export default async function TransferenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; ver?: string }>;
}) {
  await requireRol("/caja/transferencias");
  const params = await searchParams;
  const corte = await getCorteDiaComercial();
  const corteHoras = corte.ok ? corte.data : 0;
  const hoy = todayISO(new Date(), corteHoras);
  const pedida = fechaValida(params.fecha) ?? hoy;
  const fecha = pedida > hoy ? hoy : pedida;
  const todas = params.ver === "todas";

  const result = await getTransferencias(
    inicioDelDia(fecha, corteHoras),
    finDelDia(fecha, corteHoras),
  );
  const resumen = result.ok ? resumenTransferencias(result.data) : null;
  const visibles = result.ok
    ? result.data.filter((t) => todas || estadoTransferencia(t) !== "llego")
    : [];

  const enlace = (f: string, ver = todas) =>
    `/caja/transferencias?fecha=${f}${ver ? "&ver=todas" : ""}`;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Transferencias</h1>
        <p className="text-sm text-muted-foreground">
          Abrí la cuenta donde recibís las transferencias y marcá cada pago.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
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
          {todas && <input type="hidden" name="ver" value="todas" />}
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
        {fecha < hoy && (
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

      {!result.ok && <p className="text-sm text-destructive">{result.error}</p>}

      {resumen && (
        <div
          aria-label="Resumen de transferencias"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          <Total
            titulo="Sin verificar"
            cantidad={resumen.pendiente.cantidad}
            monto={resumen.pendiente.monto}
          />
          <Total
            titulo="No llegó"
            cantidad={resumen.no_llego.cantidad}
            monto={resumen.no_llego.monto}
            destacar={resumen.no_llego.cantidad > 0}
          />
          <Total
            titulo="Llegó"
            cantidad={resumen.llego.cantidad}
            monto={resumen.llego.monto}
          />
        </div>
      )}

      {result.ok && (
        <Card className="gap-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardEyebrow>
              {formatDate(fecha)}
              {fecha === hoy && " (hoy)"}
            </CardEyebrow>
            <div className="flex gap-1 text-sm">
              <Link
                href={enlace(fecha, false)}
                aria-current={!todas ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1",
                  !todas
                    ? "bg-accent font-bold text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Por revisar
              </Link>
              <Link
                href={enlace(fecha, true)}
                aria-current={todas ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1",
                  todas
                    ? "bg-accent font-bold text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Todas
              </Link>
            </div>
          </div>

          {visibles.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {result.data.length === 0
                ? "No hubo ventas cobradas por transferencia este día."
                : "No queda nada por revisar este día."}
            </p>
          ) : (
            <ul aria-label="Transferencias del día" className="flex flex-col">
              {visibles.map((t) => {
                const estado = estadoTransferencia(t);
                const ultima = t.verificaciones[0];
                return (
                  <li
                    key={t.ventaPagoId}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-3 last:border-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold tabular-nums">
                          {formatCurrency(t.monto)}
                        </span>
                        <Badge variant={ETIQUETA[estado].variant}>
                          {ETIQUETA[estado].texto}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(t.createdAt)} · {t.medio} · {t.cajero} ·{" "}
                        <Link
                          href={`/reportes/ventas/${t.ventaId}`}
                          className="underline underline-offset-2"
                        >
                          ver venta
                        </Link>
                      </p>
                      {ultima && (
                        <p className="text-xs text-muted-foreground">
                          Marcó {ultima.autor} el{" "}
                          {formatDateTime(ultima.createdAt)}
                          {t.verificaciones.length > 1 &&
                            ` · ${t.verificaciones.length} marcas`}
                        </p>
                      )}
                    </div>
                    <VerificarTransferencia
                      ventaPagoId={t.ventaPagoId}
                      estado={estado}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Marcar no cambia la venta ni la caja. Si te equivocaste, marcá lo
        contrario: queda registrado quién marcó cada cosa.
      </p>
    </main>
  );
}

function Total({
  titulo,
  cantidad,
  monto,
  destacar = false,
}: {
  titulo: string;
  cantidad: number;
  monto: number;
  destacar?: boolean;
}) {
  return (
    <Card className={cn("gap-0.5 p-4", destacar && "border-destructive")}>
      <CardEyebrow>{titulo}</CardEyebrow>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          destacar && "text-destructive",
        )}
      >
        {formatCurrency(monto)}
      </p>
      <p className="text-xs text-muted-foreground">
        {cantidad === 1 ? "1 pago" : `${cantidad} pagos`}
      </p>
    </Card>
  );
}
