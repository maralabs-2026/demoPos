"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { MoneyInput } from "@/components/ui/money-input";
import { abrirCaja } from "../actions";

// Se muestra en /vender cuando el usuario no tiene caja abierta: sin caja no se puede cobrar.
export function AbrirCaja() {
  const router = useRouter();
  const [montoInicial, setMontoInicial] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    if (montoInicial === null) {
      setError("Escribí con cuánto efectivo arranca el cajón (puede ser 0).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await abrirCaja({ montoInicial });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // La página vuelve a leer la caja y muestra la pantalla de cobro.
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-sm gap-5 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success-foreground">
          <LockOpen aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-xl">Abrí tu caja</h2>
        <p className="text-sm text-muted-foreground">
          Para cobrar necesitás una caja abierta. Contá el efectivo con el que
          arranca el cajón.
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <CardEyebrow>
            <label htmlFor="monto-inicial">Fondo inicial del cajón</label>
          </CardEyebrow>
          <MoneyInput
            id="monto-inicial"
            autoFocus
            placeholder="0,00"
            value={montoInicial}
            onValueChange={setMontoInicial}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="success"
          size="lg"
          className="w-full"
          disabled={isPending}
        >
          {isPending ? "Abriendo..." : "Abrí la caja"}
        </Button>
      </form>
    </Card>
  );
}
