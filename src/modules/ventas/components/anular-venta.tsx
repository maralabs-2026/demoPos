"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/currency";
import { anularVenta } from "../actions";
import { anularVentaSchema, MOTIVO_ANULACION_MAX } from "../schemas";

export function AnularVenta({ ventaId }: { ventaId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const parsed = anularVentaSchema.safeParse({ ventaId, motivo });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await anularVenta(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        "Venta anulada",
        result.data.retiro > 0
          ? `El stock volvió y salieron ${formatCurrency(result.data.retiro)} de tu caja.`
          : "El stock volvió.",
      );
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        className="print:hidden"
        onClick={() => setAbierto(true)}
      >
        <Ban data-icon="inline-start" />
        Anulá la venta
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Anular la venta?</DialogTitle>
            <DialogDescription>
              El stock vuelve y la venta deja de contar. No se puede deshacer.
              Si su caja ya se cerró, el efectivo sale de tu caja abierta; los
              otros medios se devuelven por fuera.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="anular-motivo" className="text-sm font-semibold">
                Motivo
              </label>
              <Input
                id="anular-motivo"
                autoComplete="off"
                maxLength={MOTIVO_ANULACION_MAX}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="destructive-solid"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Anulando..." : "Confirmá la anulación"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
