"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/date";
import { anularGasto } from "../actions";
import { estaVencido } from "../gastos";
import type { CajaParaPagar, Gasto } from "../queries";
import { GastoFormDialog } from "./gasto-form-dialog";
import { PagarGastoDialog } from "./pagar-gasto-dialog";

const TIPO_LABEL: Record<Gasto["tipo"], string> = {
  fijo: "Fijo",
  variable: "Variable",
  mercaderia: "Mercadería",
};

function detalle(gasto: Gasto): string {
  const partes = [TIPO_LABEL[gasto.tipo]];
  if (gasto.estado === "por_pagar" && gasto.vencimiento) {
    partes.push(`Vence el ${formatDate(gasto.vencimiento)}`);
  }
  if (gasto.pagadoAt) {
    partes.push(`Pagado el ${formatDateTime(gasto.pagadoAt)}`);
    if (!gasto.cajaId) partes.push("por fuera de la caja");
  }
  return partes.join(" · ");
}

function GastoFila({
  gasto,
  hoy,
  onPagar,
  onAnular,
}: {
  gasto: Gasto;
  hoy: string;
  onPagar: (gasto: Gasto) => void;
  onAnular: (gasto: Gasto) => void;
}) {
  const anulado = gasto.estado === "anulado";
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p
            className={
              anulado
                ? "text-sm font-semibold break-words text-muted-foreground line-through"
                : "text-sm font-semibold break-words"
            }
          >
            {gasto.descripcion}
          </p>
          <p className="text-xs text-muted-foreground">{detalle(gasto)}</p>
          {anulado && <Badge>Anulado</Badge>}
          {gasto.estado === "por_pagar" &&
            estaVencido(gasto.vencimiento, hoy) && (
              <Badge variant="destructive">Vencido</Badge>
            )}
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">
          {formatCurrency(gasto.monto)}
        </p>
      </div>
      {(!anulado || gasto.cajaHref) && (
        <div className="flex items-center justify-end gap-2">
          {gasto.cajaHref && (
            <Link
              href={gasto.cajaHref}
              className="mr-auto rounded-md py-1.5 text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Ver caja
            </Link>
          )}
          {!anulado && (
            <Button variant="ghost" size="sm" onClick={() => onAnular(gasto)}>
              Anulá
            </Button>
          )}
          {gasto.estado === "por_pagar" && (
            <Button variant="outline" size="sm" onClick={() => onPagar(gasto)}>
              Pagá
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function GastosScreen({
  porPagar,
  resueltos,
  cajas,
  hoy,
}: {
  porPagar: Gasto[];
  resueltos: Gasto[];
  cajas: CajaParaPagar[];
  hoy: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [aPagar, setAPagar] = useState<Gasto | null>(null);
  const [aAnular, setAAnular] = useState<Gasto | null>(null);

  async function confirmarAnular(gasto: Gasto) {
    const result = await anularGasto(gasto.id);
    if (!result.ok) {
      toast.error("No se pudo anular el gasto", result.error);
      return;
    }
    toast.success(
      "Gasto anulado",
      result.data.devuelto
        ? "La plata volvió a la caja con un ingreso."
        : gasto.descripcion,
    );
    router.refresh();
  }

  function descripcionAnular(gasto: Gasto | null): string {
    if (!gasto) return "";
    if (gasto.cajaId) {
      return `"${gasto.descripcion}" salió de una caja. Si sigue abierta, la plata vuelve con un ingreso; si ya se cerró, su cierre no cambia.`;
    }
    return `"${gasto.descripcion}" deja de contar como gasto.`;
  }

  const filaProps = { hoy, onPagar: setAPagar, onAnular: setAAnular };

  return (
    <>
      <Button className="self-start" onClick={() => setCargando(true)}>
        <Plus data-icon="inline-start" />
        Cargá un gasto
      </Button>

      <Card className="gap-1 p-5">
        <h2 className="font-display text-lg font-bold">Por pagar</h2>
        {porPagar.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay gastos por pagar.
          </p>
        ) : (
          <ul aria-label="Gastos por pagar" className="flex flex-col">
            {porPagar.map((gasto) => (
              <GastoFila key={gasto.id} gasto={gasto} {...filaProps} />
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-1 p-5">
        <h2 className="font-display text-lg font-bold">Pagados y anulados</h2>
        {resueltos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay gastos pagados.
          </p>
        ) : (
          <ul aria-label="Gastos pagados y anulados" className="flex flex-col">
            {resueltos.map((gasto) => (
              <GastoFila key={gasto.id} gasto={gasto} {...filaProps} />
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={cargando} onOpenChange={setCargando}>
        {cargando && (
          <GastoFormDialog cajas={cajas} onDone={() => setCargando(false)} />
        )}
      </Dialog>

      <Dialog
        open={aPagar !== null}
        onOpenChange={(open) => {
          if (!open) setAPagar(null);
        }}
      >
        {aPagar && (
          <PagarGastoDialog
            gasto={aPagar}
            cajas={cajas}
            onDone={() => setAPagar(null)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={aAnular !== null}
        onOpenChange={(open) => {
          if (!open) setAAnular(null);
        }}
        title="¿Anular el gasto?"
        description={descripcionAnular(aAnular)}
        confirmLabel="Anular"
        destructive
        onConfirm={() => {
          if (aAnular) void confirmarAnular(aAnular);
        }}
      />
    </>
  );
}
