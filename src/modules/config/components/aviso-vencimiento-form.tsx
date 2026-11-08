"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { guardarAvisoVencimiento } from "../actions";
import { AVISO_VENCIMIENTO_MAX } from "../schemas";

export function AvisoVencimientoForm({ inicial }: { inicial: number }) {
  const router = useRouter();
  const [dias, setDias] = useState(String(inicial));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await guardarAvisoVencimiento({ dias: Number(dias) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Días de aviso guardados");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-lg gap-4 p-5">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="aviso-vencimiento" className="text-sm font-semibold">
            Avisar los vencimientos con estos días de anticipación
          </label>
          <Input
            id="aviso-vencimiento"
            type="number"
            inputMode="numeric"
            min={1}
            max={AVISO_VENCIMIENTO_MAX}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            El inicio muestra lo que ya venció y lo que vence dentro de estos
            días.
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardá los días de aviso"}
        </Button>
      </form>
    </Card>
  );
}
