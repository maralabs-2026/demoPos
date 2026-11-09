"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { registrarAjusteCaja, registrarMovimiento } from "../actions";
import type { MovimientoCaja } from "../queries";
import {
  MOTIVO_MOVIMIENTO_MAX,
  registrarAjusteSchema,
  registrarMovimientoSchema,
} from "../schemas";
import { MovimientosLista } from "./movimientos-lista";

type Tipo = MovimientoCaja["tipo"];

const TIPOS: { value: Tipo; label: string }[] = [
  { value: "retiro", label: "Retiro" },
  { value: "ingreso", label: "Ingreso" },
];

// Efectivo que sale o entra del cajón durante el turno. Un error no se edita: se compensa con el
// movimiento contrario. Un ajuste lo carga el dueño, o cualquiera con un código que generó el dueño.
export function MovimientosCaja({
  cajaId,
  movimientos,
  esDueno,
}: {
  cajaId: string;
  movimientos: MovimientoCaja[];
  esDueno: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("retiro");
  const [monto, setMonto] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [esAjuste, setEsAjuste] = useState(false);
  const [codigo, setCodigo] = useState("");
  // Cambia al registrar para vaciar el campo de monto, que guarda lo escrito.
  const [montoKey, setMontoKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const datos = { cajaId, tipo, monto: monto ?? undefined, motivo };
    let enviar: () => ReturnType<typeof registrarMovimiento>;
    if (esAjuste) {
      const parsed = registrarAjusteSchema.safeParse({
        ...datos,
        codigo: esDueno ? null : codigo,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
        return;
      }
      enviar = () => registrarAjusteCaja(parsed.data);
    } else {
      const parsed = registrarMovimientoSchema.safeParse(datos);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
        return;
      }
      enviar = () => registrarMovimiento(parsed.data);
    }
    setError(null);

    startTransition(async () => {
      const result = await enviar();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMonto(null);
      setMotivo("");
      setEsAjuste(false);
      setCodigo("");
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

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-4"
            checked={esAjuste}
            onChange={(e) => setEsAjuste(e.target.checked)}
          />
          Es un ajuste de caja
        </label>

        {esAjuste && !esDueno && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ajuste-codigo" className="text-sm font-semibold">
              Código del dueño
            </label>
            <Input
              id="ajuste-codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6 números"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-xs text-muted-foreground">
              Pedíselo al dueño: vence a los 10 minutos y sirve una sola vez.
            </p>
          </div>
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
