"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/currency";
import { pagarGasto } from "../actions";
import type { CajaParaPagar, Gasto } from "../queries";
import { FormaDePago, POR_FUERA } from "./forma-de-pago";

export function PagarGastoDialog({
  gasto,
  cajas,
  onDone,
}: {
  gasto: Gasto;
  cajas: CajaParaPagar[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [origen, setOrigen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    if (origen === "") {
      setError("Elegí de dónde salió la plata.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await pagarGasto({
        gastoId: gasto.id,
        cajaId: origen === POR_FUERA ? null : origen,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Gasto pagado", gasto.descripcion);
      onDone();
      router.refresh();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Pagá el gasto</DialogTitle>
        <DialogDescription>
          {gasto.descripcion} · {formatCurrency(gasto.monto)}
        </DialogDescription>
      </DialogHeader>

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormaDePago
          id="pagar-origen"
          cajas={cajas}
          value={origen}
          onChange={setOrigen}
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Pagando..." : "Confirmá el pago"}
        </Button>
      </form>
    </DialogContent>
  );
}
