"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { cambiarActivoPuntoQr, crearPuntoQr } from "../actions";
import type { PuntoQr } from "../queries";

function NuevoQr({ onListo }: { onListo: () => void }) {
  const [nombre, setNombre] = useState("");
  const [externalPosId, setExternalPosId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await crearPuntoQr({ nombre, externalPosId });
      if (result.ok) onListo();
      else setError(result.error);
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Agregá un QR</DialogTitle>
      </DialogHeader>
      <form noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qr-nombre" className="text-sm font-semibold">
            Nombre
          </label>
          <Input
            id="qr-nombre"
            autoComplete="off"
            maxLength={60}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qr-pos" className="text-sm font-semibold">
            Identificador de la caja en Mercado Pago
          </label>
          <Input
            id="qr-pos"
            autoComplete="off"
            maxLength={40}
            value={externalPosId}
            onChange={(e) => setExternalPosId(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardá el QR"}
        </Button>
      </form>
    </DialogContent>
  );
}

export function PuntosQrScreen({
  puntos,
  conectado,
}: {
  puntos: PuntoQr[];
  conectado: boolean;
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);

  async function cambiarActivo(punto: PuntoQr) {
    const result = await cambiarActivoPuntoQr(punto.id, !punto.activo);
    if (!result.ok) {
      toast.error("No se pudo cambiar el QR", result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section aria-label="QR de Mercado Pago" className="flex flex-col gap-3">
      <h2 className="text-xl">QR de Mercado Pago</h2>
      {!conectado && (
        <p className="text-sm text-muted-foreground">
          Mercado Pago todavía no está conectado. Podés cargar los QR, pero el
          cobro no se confirma solo hasta conectarlo.
        </p>
      )}
      <Button className="self-start" onClick={() => setCreando(true)}>
        <Plus data-icon="inline-start" />
        Agregá un QR
      </Button>

      {puntos.length > 0 && (
        <Card className="gap-1 p-5">
          <ul aria-label="QR cargados" className="flex flex-col">
            {puntos.map((punto) => (
              <li
                key={punto.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 last:border-0"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm font-semibold break-words">
                    {punto.nombre}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{punto.external_pos_id}</Badge>
                    {!punto.activo && (
                      <Badge variant="destructive">Inactivo</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void cambiarActivo(punto)}
                >
                  {punto.activo ? "Desactivá" : "Activá"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={creando} onOpenChange={setCreando}>
        {creando && (
          <NuevoQr
            onListo={() => {
              setCreando(false);
              router.refresh();
            }}
          />
        )}
      </Dialog>
    </section>
  );
}
