"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyInput } from "@/components/ui/money-input";
import { formatDateTime } from "@/lib/date";
import { cerrarCaja } from "../actions";
import type { MedioAContar } from "../queries";
import { NOTA_CIERRE_MAX } from "../schemas";

// Cierre a ciegas: se cuenta sin ver el esperado, que aparece recién en el resultado.
export function CerrarCajaForm({
  cajaId,
  abiertaAt,
  titular,
  medios,
}: {
  cajaId: string;
  abiertaAt: string;
  // Solo si la caja es de otro usuario.
  titular?: string;
  medios: MedioAContar[];
}) {
  const router = useRouter();
  const [contados, setContados] = useState<Record<string, number | null>>({});
  const [nota, setNota] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const falta = medios.find((m) => (contados[m.id] ?? null) === null);
    if (falta) {
      setError(`Escribí cuánto contaste en ${falta.nombre} (puede ser 0).`);
      setConfirmando(false);
      return;
    }
    setError(null);

    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    startTransition(async () => {
      const result = await cerrarCaja({
        cajaId,
        conteos: medios.map((m) => ({
          medioPagoId: m.id,
          contado: contados[m.id] as number,
        })),
        nota,
      });
      if (!result.ok) {
        setError(result.error);
        setConfirmando(false);
        return;
      }
      router.push(`/caja/historial/${result.data.cajaId}`);
    });
  }

  return (
    <Card className="w-full max-w-lg gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">
          {titular ? `Caja de ${titular}` : "Cerrá tu caja"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Abierta el {formatDateTime(abiertaAt)}. Contá lo que hay en cada medio
          de pago; en efectivo, incluí el fondo inicial.
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {medios.map((medio) => (
            <div
              key={medio.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3"
            >
              <label
                htmlFor={`contado-${medio.id}`}
                className="text-sm font-semibold"
              >
                {medio.nombre}
              </label>
              <MoneyInput
                id={`contado-${medio.id}`}
                placeholder="0,00"
                value={contados[medio.id] ?? null}
                onValueChange={(valor) => {
                  setContados((prev) => ({ ...prev, [medio.id]: valor }));
                  setConfirmando(false);
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota-cierre" className="text-sm font-semibold">
            Nota (opcional)
          </label>
          <textarea
            id="nota-cierre"
            rows={2}
            maxLength={NOTA_CIERRE_MAX}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {confirmando && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning-foreground">
            Un cierre no se puede corregir después. Revisá los montos antes de
            confirmar.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            variant={confirmando ? "success" : "default"}
            size="lg"
            className="w-full"
            disabled={isPending}
          >
            <Lock data-icon="inline-start" />
            {isPending
              ? "Cerrando..."
              : confirmando
                ? "Confirmá el cierre"
                : "Cerrá la caja"}
          </Button>
          {confirmando && (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirmando(false)}
            >
              Volvé a revisar
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
