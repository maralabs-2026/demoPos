"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { registrarAjusteCaja, registrarMovimiento } from "../actions";
import type { MovimientoCaja } from "../queries";
import { MOTIVO_MOVIMIENTO_MAX, registrarMovimientoSchema } from "../schemas";
import { MovimientosLista } from "./movimientos-lista";

type Tipo = MovimientoCaja["tipo"];

const TIPOS: { value: Tipo; label: string }[] = [
  { value: "retiro", label: "Retiro" },
  { value: "ingreso", label: "Ingreso" },
];

// Efectivo que sale o entra del cajón durante el turno. Un error no se edita: se compensa con el
// movimiento contrario.
export function MovimientosCaja({
  cajaId,
  movimientos,
  puedeAjustar,
}: {
  cajaId: string;
  movimientos: MovimientoCaja[];
  puedeAjustar: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("retiro");
  const [monto, setMonto] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [esAjuste, setEsAjuste] = useState(false);
  // Cambia al registrar para vaciar el campo de monto, que guarda lo escrito.
  const [montoKey, setMontoKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const parsed = registrarMovimientoSchema.safeParse({
      cajaId,
      tipo,
      monto: monto ?? undefined,
      motivo,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = esAjuste
        ? await registrarAjusteCaja(parsed.data)
        : await registrarMovimiento(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMonto(null);
      setMotivo("");
      setEsAjuste(false);
      setMontoKey((key) => key + 1);
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-lg gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">Retiros e ingresos</h2>
        <p className="text-sm text-muted-foreground">
          Registrá el efectivo que sacás o ponés en el cajón. Si te equivocás,
          cargá el movimiento contrario.
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div
          role="group"
          aria-label="Tipo de movimiento"
          className="grid grid-cols-2 gap-2"
        >
          {TIPOS.map((opcion) => (
            <Button
              key={opcion.value}
              type="button"
              variant={tipo === opcion.value ? "default" : "outline"}
              aria-pressed={tipo === opcion.value}
              onClick={() => setTipo(opcion.value)}
            >
              {opcion.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="movimiento-monto" className="text-sm font-semibold">
            Monto
          </label>
          <MoneyInput
            key={montoKey}
            id="movimiento-monto"
            value={monto}
            onValueChange={setMonto}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="movimiento-motivo" className="text-sm font-semibold">
            Motivo
          </label>
          <Input
            id="movimiento-motivo"
            autoComplete="off"
            maxLength={MOTIVO_MOVIMIENTO_MAX}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        {puedeAjustar && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-4"
              checked={esAjuste}
              onChange={(e) => setEsAjuste(e.target.checked)}
            />
            Es un ajuste de caja
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending
            ? "Registrando..."
            : esAjuste
              ? "Registrá el ajuste"
              : tipo === "retiro"
                ? "Registrá el retiro"
                : "Registrá el ingreso"}
        </Button>
      </form>

      {movimientos.length > 0 && <MovimientosLista movimientos={movimientos} />}
    </Card>
  );
}
