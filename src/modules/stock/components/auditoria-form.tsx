"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { aplicarAuditoria, type LineaAuditoria } from "../actions";
import type { ProductoAContar } from "../queries";

function DiferenciaUnidades({ diferencia }: { diferencia: number }) {
  if (diferencia === 0) return <Badge variant="success">Cuadra</Badge>;
  const cantidad = Math.abs(diferencia);
  return (
    <Badge variant={diferencia > 0 ? "warning" : "destructive"}>
      {diferencia > 0 ? "Sobran" : "Faltan"} {cantidad}
    </Badge>
  );
}

// Conteo a ciegas: la pantalla no recibe el stock del sistema, que aparece recién en el resultado.
export function AuditoriaForm({
  categoriaId,
  productos,
}: {
  categoriaId: string | null;
  productos: ProductoAContar[];
}) {
  const router = useRouter();
  const [contados, setContados] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    motivo: string;
    lineas: LineaAuditoria[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const cargados = productos.filter(
    (p) => (contados[p.id] ?? "").trim() !== "",
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    if (cargados.length === 0) {
      setError("Contá al menos un producto.");
      return;
    }
    const invalido = cargados.find(
      (p) => !/^\d+$/.test((contados[p.id] ?? "").trim()),
    );
    if (invalido) {
      setError(`Revisá ${invalido.nombre}: contá unidades enteras.`);
      setConfirmando(false);
      return;
    }
    setError(null);

    if (!confirmando) {
      setConfirmando(true);
      return;
    }

    startTransition(async () => {
      const result = await aplicarAuditoria({
        categoriaId,
        conteos: cargados.map((p) => ({
          productoId: p.id,
          contado: Number(contados[p.id]),
        })),
      });
      if (!result.ok) {
        setError(result.error);
        setConfirmando(false);
        return;
      }
      toast.success("Auditoría aplicada", result.data.motivo);
      setResultado(result.data);
      router.refresh();
    });
  }

  if (resultado) {
    const conDiferencia = resultado.lineas.filter(
      (l) => l.diferencia !== 0,
    ).length;
    return (
      <Card className="gap-3 p-5">
        <h2 className="font-display text-lg font-bold">Resultado</h2>
        <p className="text-sm text-muted-foreground">
          {conDiferencia === 0
            ? "Todo cuadra: no se generó ningún ajuste."
            : `Se ${conDiferencia === 1 ? "generó 1 ajuste" : `generaron ${conDiferencia} ajustes`} con el motivo "${resultado.motivo}".`}
        </p>
        <ul aria-label="Resultado de la auditoría" className="flex flex-col">
          {resultado.lineas.map((linea) => (
            <li
              key={linea.productoId}
              className="flex flex-col gap-1 border-b border-border py-2.5 text-sm last:border-0"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-semibold break-words">
                  {linea.nombre}
                </span>
                <DiferenciaUnidades diferencia={linea.diferencia} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                Sistema {linea.sistema} · Contado {linea.contado}
              </span>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          onClick={() => {
            setResultado(null);
            setContados({});
            setConfirmando(false);
          }}
        >
          Hacé otro conteo
        </Button>
      </Card>
    );
  }

  return (
    <Card className="gap-4 p-5">
      <p className="text-sm text-muted-foreground">
        Contá lo que hay y escribilo. Lo que dejes vacío no se toca; si no hay
        ninguno, escribí 0. Conviene hacerlo con el local tranquilo: una venta
        mientras contás aparece como diferencia.
      </p>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {productos.map((producto) => (
            <div
              key={producto.id}
              className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3"
            >
              <label htmlFor={`contado-${producto.id}`} className="min-w-0">
                <span className="block text-sm font-semibold break-words">
                  {producto.nombre}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {producto.codigoBarras}
                </span>
              </label>
              <Input
                id={`contado-${producto.id}`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="text-right tabular-nums"
                value={contados[producto.id] ?? ""}
                onChange={(e) => {
                  setContados((prev) => ({
                    ...prev,
                    [producto.id]: e.target.value,
                  }));
                  setConfirmando(false);
                }}
              />
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {confirmando && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning-foreground">
            Contaste {cargados.length} de {productos.length}{" "}
            {productos.length === 1 ? "producto" : "productos"}. Cada diferencia
            genera un ajuste de stock que no se deshace.
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          variant={confirmando ? "success" : "default"}
          disabled={isPending}
        >
          {isPending
            ? "Aplicando..."
            : confirmando
              ? "Confirmá la auditoría"
              : "Aplicá la auditoría"}
        </Button>
      </form>
    </Card>
  );
}
