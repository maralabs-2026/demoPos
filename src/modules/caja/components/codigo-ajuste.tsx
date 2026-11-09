"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyInput } from "@/components/ui/money-input";
import { formatCurrency } from "@/lib/currency";
import { formatTime } from "@/lib/date";
import { generarCodigoAjuste } from "../actions";
import { generarCodigoAjusteSchema } from "../schemas";

type Generado = { codigo: string; venceAt: string; montoMax: number };

// Solo para el dueño, en la caja de otro: genera el código que autoriza un ajuste. El código se
// muestra una sola vez; si se pierde, se genera otro (y el anterior deja de servir).
export function CodigoAjuste({
  cajaId,
  titular,
}: {
  cajaId: string;
  titular: string;
}) {
  const [montoMax, setMontoMax] = useState<number | null>(null);
  const [generado, setGenerado] = useState<Generado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const parsed = generarCodigoAjusteSchema.safeParse({
      cajaId,
      montoMax: montoMax ?? undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await generarCodigoAjuste(parsed.data);
      if (!result.ok) {
        setGenerado(null);
        setError(result.error);
        return;
      }
      setGenerado({ ...result.data, montoMax: parsed.data.montoMax });
    });
  }

  return (
    <Card className="w-full max-w-lg gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">Código de ajuste</h2>
        <p className="text-sm text-muted-foreground">
          Para que {titular} cargue un ajuste en esta caja. Vence a los 10
          minutos y sirve una sola vez.
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="codigo-monto-max" className="text-sm font-semibold">
            Monto máximo
          </label>
          <MoneyInput
            id="codigo-monto-max"
            value={montoMax}
            onValueChange={setMontoMax}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Generando..." : "Generá el código"}
        </Button>
      </form>

      {generado && (
        <div
          role="status"
          className="flex flex-col items-center gap-1 rounded-lg bg-muted p-4 text-center"
        >
          <p
            className="font-display text-4xl font-bold tracking-[0.3em] tabular-nums"
            aria-label={`Código ${generado.codigo.split("").join(" ")}`}
          >
            {generado.codigo}
          </p>
          <p className="text-sm text-muted-foreground">
            Hasta {formatCurrency(generado.montoMax)} · vence a las{" "}
            {formatTime(generado.venceAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            Si generás otro, este deja de servir.
          </p>
        </div>
      )}
    </Card>
  );
}
