"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { guardarNombreComercio } from "../actions";
import { NOMBRE_CONFIG_MAX } from "../schemas";

export function ComercioForm({ nombreInicial }: { nombreInicial: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await guardarNombreComercio({ nombre });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Nombre guardado");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-lg gap-4 p-5">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="comercio-nombre" className="text-sm font-semibold">
            Nombre del comercio
          </label>
          <Input
            id="comercio-nombre"
            autoComplete="organization"
            maxLength={NOMBRE_CONFIG_MAX}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            Se ve en el menú y es el texto alternativo del logo.
          </span>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardá el nombre"}
        </Button>
      </form>
    </Card>
  );
}
