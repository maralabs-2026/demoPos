"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { verificarTransferencia } from "../actions";
import type { EstadoVerificacion } from "../schemas";
import type { EstadoTransferencia } from "../transferencias";

// Los dos botones de una transferencia. Solo se ofrece el que cambia el estado: una marca no se
// borra, se corrige marcando la contraria.
export function VerificarTransferencia({
  ventaPagoId,
  estado,
}: {
  ventaPagoId: string;
  estado: EstadoTransferencia;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function marcar(nuevo: EstadoVerificacion) {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await verificarTransferencia({
        ventaPagoId,
        estado: nuevo,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        nuevo === "llego"
          ? "Marcada como recibida"
          : "Marcada como no recibida",
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {estado !== "llego" && (
          <Button
            size="sm"
            variant={estado === "pendiente" ? "success" : "outline"}
            onClick={() => marcar("llego")}
            disabled={isPending}
          >
            <Check data-icon="inline-start" />
            Llegó
          </Button>
        )}
        {estado !== "no_llego" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => marcar("no_llego")}
            disabled={isPending}
          >
            <X data-icon="inline-start" />
            No llegó
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
