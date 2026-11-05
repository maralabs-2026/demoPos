"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import {
  cambiarActivoMedioPago,
  crearMedioPago,
  renombrarMedioPago,
} from "../actions";
import type { MedioPago, MedioPagoConfig } from "../queries";
import { TIPOS_MEDIO_PAGO } from "../schemas";
import { NombreDialog } from "./nombre-dialog";

const TIPO_LABEL: Record<MedioPago["tipo"], string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  qr: "QR",
  cuenta_corriente: "Cuenta corriente",
};

type Tipo = (typeof TIPOS_MEDIO_PAGO)[number];

export function MediosPagoScreen({ medios }: { medios: MedioPagoConfig[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState<Tipo>("tarjeta");
  const [aRenombrar, setARenombrar] = useState<MedioPagoConfig | null>(null);

  async function cambiarActivo(medio: MedioPagoConfig) {
    const result = await cambiarActivoMedioPago(medio.id, !medio.activo);
    if (!result.ok) {
      toast.error("No se pudo cambiar el medio", result.error);
      return;
    }
    toast.success(
      medio.activo ? "Medio desactivado" : "Medio activado",
      medio.nombre,
    );
    router.refresh();
  }

  return (
    <>
      <Button className="self-start" onClick={() => setCreando(true)}>
        <Plus data-icon="inline-start" />
        Agregá un medio
      </Button>

      <Card className="gap-1 p-5">
        <ul aria-label="Medios de pago" className="flex flex-col">
          {medios.map((medio) => (
            <li
              key={medio.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 last:border-0"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p
                  className={
                    medio.activo
                      ? "text-sm font-semibold break-words"
                      : "text-sm font-semibold break-words text-muted-foreground"
                  }
                >
                  {medio.nombre}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge>{TIPO_LABEL[medio.tipo]}</Badge>
                  {!medio.activo && (
                    <Badge variant="destructive">Inactivo</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void cambiarActivo(medio)}
                >
                  {medio.activo ? "Desactivá" : "Activá"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setARenombrar(medio)}
                >
                  Renombrá
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-muted-foreground">
        Un medio no se borra, porque las ventas pasadas lo usan. Si lo
        desactivás, deja de ofrecerse al cobrar.
      </p>

      <Dialog open={creando} onOpenChange={setCreando}>
        {creando && (
          <NombreDialog
            titulo="Agregá un medio de pago"
            boton="Guardá el medio"
            extra={
              <div className="flex flex-col gap-1.5">
                <label htmlFor="medio-tipo" className="text-sm font-semibold">
                  Tipo
                </label>
                <select
                  id="medio-tipo"
                  value={tipoNuevo}
                  onChange={(e) => setTipoNuevo(e.target.value as Tipo)}
                  className="h-11 rounded-lg border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {TIPOS_MEDIO_PAGO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {TIPO_LABEL[tipo]}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  No se puede cambiar una vez que tenga pagos.
                </span>
              </div>
            }
            onGuardar={async (nombre) => {
              const result = await crearMedioPago({ nombre, tipo: tipoNuevo });
              if (result.ok) {
                toast.success("Medio agregado", nombre.trim());
                setCreando(false);
                router.refresh();
              }
              return result;
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={aRenombrar !== null}
        onOpenChange={(open) => {
          if (!open) setARenombrar(null);
        }}
      >
        {aRenombrar && (
          <NombreDialog
            titulo="Renombrá el medio"
            boton="Guardá el nombre"
            inicial={aRenombrar.nombre}
            onGuardar={async (nombre) => {
              const result = await renombrarMedioPago({
                id: aRenombrar.id,
                nombre,
              });
              if (result.ok) {
                toast.success("Medio guardado", nombre.trim());
                setARenombrar(null);
                router.refresh();
              }
              return result;
            }}
          />
        )}
      </Dialog>
    </>
  );
}
