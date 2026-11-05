"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { guardarTicket } from "../actions";
import type { TicketConfig } from "../queries";
import { TEXTO_TICKET_MAX } from "../schemas";

const CAMPOS: { campo: keyof TicketConfig; label: string; ayuda: string }[] = [
  {
    campo: "titulo",
    label: "Título",
    ayuda: "Arriba de todo. Suele ser el nombre del comercio.",
  },
  {
    campo: "leyenda",
    label: "Leyenda",
    ayuda: "Por ejemplo, que el ticket no es fiscal.",
  },
  { campo: "pie", label: "Pie", ayuda: "El saludo al final del ticket." },
];

export function TicketForm({ inicial }: { inicial: TicketConfig }) {
  const router = useRouter();
  const [valores, setValores] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await guardarTicket(valores);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Ticket guardado", "Se usa desde la próxima venta.");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-lg gap-4 p-5">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {CAMPOS.map(({ campo, label, ayuda }) => (
          <div key={campo} className="flex flex-col gap-1.5">
            <label
              htmlFor={`ticket-${campo}`}
              className="text-sm font-semibold"
            >
              {label}
            </label>
            <Input
              id={`ticket-${campo}`}
              autoComplete="off"
              maxLength={TEXTO_TICKET_MAX}
              value={valores[campo]}
              onChange={(e) =>
                setValores((prev) => ({ ...prev, [campo]: e.target.value }))
              }
            />
            <span className="text-xs text-muted-foreground">{ayuda}</span>
          </div>
        ))}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardá el ticket"}
        </Button>
      </form>
    </Card>
  );
}
