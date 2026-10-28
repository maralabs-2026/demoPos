"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { actualizarPrecios } from "../actions";
import type { Categoria, Producto } from "../queries";
import { PORCENTAJE_MAX, PORCENTAJE_MIN, precioActualizado } from "../schemas";

const TODAS = "todas";

export function PreciosForm({
  productos,
  categorias,
}: {
  productos: Producto[];
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [categoria, setCategoria] = useState(TODAS);
  const [porcentaje, setPorcentaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoriaId = categoria === TODAS ? null : categoria;
  const afectados = useMemo(
    () =>
      categoriaId === null
        ? productos
        : productos.filter((p) => p.categoriaId === categoriaId),
    [productos, categoriaId],
  );

  const pct = Number(porcentaje.replace(",", "."));
  const pctValido =
    porcentaje !== "" &&
    Number.isFinite(pct) &&
    pct !== 0 &&
    pct >= PORCENTAJE_MIN &&
    pct <= PORCENTAJE_MAX;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const result = await actualizarPrecios({ categoriaId, porcentaje: pct });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPorcentaje("");
      setAviso(
        result.data.actualizados === 1
          ? "Se actualizó 1 precio."
          : `Se actualizaron ${result.data.actualizados} precios.`,
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Categoría</span>
          <select
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setError(null);
            }}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
          >
            <option value={TODAS}>Todo el catálogo</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Porcentaje</span>
          <Input
            inputMode="decimal"
            required
            autoFocus
            placeholder="Ej.: 10 o -5"
            value={porcentaje}
            onChange={(e) => {
              setPorcentaje(e.target.value);
              setAviso(null);
            }}
            className="tabular-nums"
          />
        </label>
      </div>

      <p className="text-muted-foreground text-sm">
        {porcentaje !== "" && !pctValido
          ? `Usá un porcentaje entre ${PORCENTAJE_MIN} y ${PORCENTAJE_MAX}, distinto de 0. Para bajar, poné un signo menos.`
          : `${afectados.length} ${afectados.length === 1 ? "producto" : "productos"} en ${
              categoriaId === null ? "todo el catálogo" : "esta categoría"
            }. El precio nuevo se redondea a centavos.`}
      </p>

      {afectados.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Precio actual</TableHead>
                <TableHead className="text-right">Precio nuevo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {afectados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-normal">
                    {p.nombre}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.precio)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      pctValido &&
                        (pct > 0 ? "text-emerald-600" : "text-destructive"),
                    )}
                  >
                    {pctValido
                      ? formatCurrency(precioActualizado(p.precio, pct))
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="text-sm text-emerald-600">
          {aviso}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || !pctValido || afectados.length === 0}
      >
        {isPending
          ? "Actualizando…"
          : pctValido
            ? `Aplicá ${pct > 0 ? "+" : ""}${pct.toLocaleString("es-AR")} % a ${afectados.length} ${
                afectados.length === 1 ? "producto" : "productos"
              }`
            : "Aplicá el cambio"}
      </Button>
    </form>
  );
}
