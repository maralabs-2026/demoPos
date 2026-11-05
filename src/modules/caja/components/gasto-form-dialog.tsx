"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toaster";
import { registrarGasto } from "../actions";
import type { CajaParaPagar } from "../queries";
import { DESCRIPCION_GASTO_MAX, registrarGastoSchema } from "../schemas";
import { FormaDePago, POR_FUERA } from "./forma-de-pago";

type Tipo = "fijo" | "variable";

function Opciones<T extends string>({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string;
  value: T;
  opciones: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {opciones.map((opcion) => (
        <Button
          key={opcion.value}
          type="button"
          variant={value === opcion.value ? "default" : "outline"}
          aria-pressed={value === opcion.value}
          onClick={() => onChange(opcion.value)}
        >
          {opcion.label}
        </Button>
      ))}
    </div>
  );
}

// El contenido se monta al abrir el popup: cada apertura arranca con el formulario vacío.
export function GastoFormDialog({
  cajas,
  onDone,
}: {
  cajas: CajaParaPagar[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<Tipo>("variable");
  const [monto, setMonto] = useState<number | null>(null);
  const [pagado, setPagado] = useState<"si" | "no">("si");
  const [origen, setOrigen] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const esPagado = pagado === "si";
    if (esPagado && origen === "") {
      setError("Elegí de dónde salió la plata.");
      return;
    }
    const parsed = registrarGastoSchema.safeParse({
      descripcion,
      tipo,
      monto: monto ?? undefined,
      vencimiento: !esPagado && vencimiento ? vencimiento : null,
      pagado: esPagado,
      cajaId: esPagado && origen !== POR_FUERA ? origen : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await registrarGasto(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Gasto cargado", parsed.data.descripcion);
      onDone();
      router.refresh();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Cargá un gasto</DialogTitle>
        <DialogDescription>
          Un gasto no se edita. Si te equivocás, anulalo y cargalo de nuevo.
        </DialogDescription>
      </DialogHeader>

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gasto-descripcion" className="text-sm font-semibold">
            Descripción
          </label>
          <Input
            id="gasto-descripcion"
            autoComplete="off"
            maxLength={DESCRIPCION_GASTO_MAX}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="gasto-monto" className="text-sm font-semibold">
            Monto
          </label>
          <MoneyInput id="gasto-monto" value={monto} onValueChange={setMonto} />
        </div>

        <Opciones<Tipo>
          label="Tipo de gasto"
          value={tipo}
          onChange={setTipo}
          opciones={[
            { value: "variable", label: "Variable" },
            { value: "fijo", label: "Fijo" },
          ]}
        />

        <Opciones<"si" | "no">
          label="Estado del gasto"
          value={pagado}
          onChange={setPagado}
          opciones={[
            { value: "si", label: "Ya lo pagué" },
            { value: "no", label: "Por pagar" },
          ]}
        />

        {pagado === "si" ? (
          <FormaDePago
            id="gasto-origen"
            cajas={cajas}
            value={origen}
            onChange={setOrigen}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="gasto-vencimiento"
              className="text-sm font-semibold"
            >
              Vencimiento (opcional)
            </label>
            <Input
              id="gasto-vencimiento"
              type="date"
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardá el gasto"}
        </Button>
      </form>
    </DialogContent>
  );
}
