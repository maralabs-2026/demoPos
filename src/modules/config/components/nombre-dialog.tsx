"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/result";
import { NOMBRE_CONFIG_MAX } from "../schemas";

// Popup para crear o renombrar algo que tiene un nombre. El contenido se monta al abrirlo.
export function NombreDialog({
  titulo,
  boton,
  inicial = "",
  extra,
  onGuardar,
}: {
  titulo: string;
  boton: string;
  inicial?: string;
  extra?: ReactNode;
  onGuardar: (nombre: string) => Promise<ActionResult<null>>;
}) {
  const [nombre, setNombre] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await onGuardar(nombre);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{titulo}</DialogTitle>
      </DialogHeader>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="config-nombre" className="text-sm font-semibold">
            Nombre
          </label>
          <Input
            id="config-nombre"
            autoComplete="off"
            maxLength={NOMBRE_CONFIG_MAX}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        {extra}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : boton}
        </Button>
      </form>
    </DialogContent>
  );
}
