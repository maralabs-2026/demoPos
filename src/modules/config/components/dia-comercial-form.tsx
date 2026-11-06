"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { guardarCorteDia } from "../actions";
import { CORTE_DIA_MAX } from "../schemas";

const HORAS = Array.from({ length: CORTE_DIA_MAX + 1 }, (_, h) => h);

function etiqueta(h: number): string {
  const hora = `${String(h).padStart(2, "0")}:00`;
  return h === 0 ? `${hora} (medianoche)` : hora;
}

export function DiaComercialForm({ inicial }: { inicial: number }) {
  const router = useRouter();
  const [horas, setHoras] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await guardarCorteDia({ horas });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Hora de corte guardada");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-lg gap-4 p-5">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="dia-comercial-corte"
            className="text-sm font-semibold"
          >
            El día termina a las
          </label>
          <select
            id="dia-comercial-corte"
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value))}
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {HORAS.map((h) => (
              <option key={h} value={h}>
                {etiqueta(h)}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Para comercios que abren de noche. Con 06:00, lo que se vende de
            madrugada cuenta para el día anterior, y un turno de 22 a 6 queda
            entero en un solo día del inicio y los reportes.
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardá la hora de corte"}
        </Button>
      </form>
    </Card>
  );
}
