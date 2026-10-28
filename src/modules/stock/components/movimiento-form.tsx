"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { registrarAjuste, registrarIngreso } from "../actions";

type Modo = "ingreso" | "ajuste";
type Sentido = "sumar" | "restar";

export function MovimientoForm({
  productoId,
  stockActual,
  unidadVenta,
  onRegistrado,
}: {
  productoId: string;
  stockActual: number;
  unidadVenta: string;
  onRegistrado: (stockActual: number, mensaje: string) => void;
}) {
  const [modo, setModo] = useState<Modo>("ingreso");
  const [sentido, setSentido] = useState<Sentido>("restar");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const n = Number(cantidad);
  const cantidadValida = cantidad !== "" && Number.isInteger(n) && n > 0;
  const delta = modo === "ajuste" && sentido === "restar" ? -n : n;
  const quedaria = cantidadValida ? stockActual + delta : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        modo === "ingreso"
          ? await registrarIngreso({ productoId, cantidad: n, motivo })
          : await registrarAjuste({ productoId, sentido, cantidad: n, motivo });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCantidad("");
      setMotivo("");
      onRegistrado(
        result.data.stockActual,
        modo === "ingreso" ? "Ingreso registrado" : "Ajuste registrado",
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div role="tablist" aria-label="Tipo de movimiento" className="flex gap-2">
        {(["ingreso", "ajuste"] as const).map((m) => (
          <Button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            variant={modo === m ? "default" : "outline"}
            onClick={() => {
              setModo(m);
              setError(null);
            }}
          >
            {m === "ingreso" ? "Ingreso de mercadería" : "Ajuste manual"}
          </Button>
        ))}
      </div>

      {modo === "ajuste" && (
        <fieldset className="flex gap-2">
          <legend className="sr-only">Sumar o restar</legend>
          {(["restar", "sumar"] as const).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              aria-pressed={sentido === s}
              variant={sentido === s ? "secondary" : "ghost"}
              onClick={() => setSentido(s)}
            >
              {s === "restar" ? "Restar" : "Sumar"}
            </Button>
          ))}
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Cantidad</span>
          <Input
            id="stock-cantidad"
            // El form se monta de nuevo con cada producto elegido: el foco va directo a la
            // cantidad, sin tabular por las pestañas.
            autoFocus
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="tabular-nums"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">
            {modo === "ingreso" ? "Detalle (opcional)" : "Motivo"}
          </span>
          <Input
            id="stock-motivo"
            required={modo === "ajuste"}
            maxLength={200}
            placeholder={
              modo === "ingreso" ? "Ej.: remito 0001-1234" : "Ej.: vencido, roto, conteo"
            }
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
      </div>

      <p
        className={cn(
          "text-sm tabular-nums",
          quedaria !== null && quedaria < 0 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {quedaria === null
          ? `Stock actual: ${stockActual} ${unidadVenta}`
          : quedaria < 0
            ? `No podés restar más de lo que hay (quedan ${stockActual}).`
            : `Stock actual: ${stockActual} → queda en ${quedaria} ${unidadVenta}`}
      </p>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || !cantidadValida || (quedaria !== null && quedaria < 0)}
      >
        {isPending
          ? "Guardando…"
          : modo === "ingreso"
            ? "Registrá el ingreso"
            : "Registrá el ajuste"}
      </Button>
    </form>
  );
}
