"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, parseMonto } from "@/lib/currency";
import type { Producto } from "@/modules/productos";
import { cambiarActivaCombo, crearCombo, eliminarCombo } from "../actions";
import type { Combo } from "../logica";
import type { ComboInput } from "../schemas";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Combos fijos: varios productos distintos por un precio. Se aplican solos en el ticket cuando
// están todos sus productos y la promo está vigente (ver logica.ts).
export function CombosSection({
  combos,
  productos,
}: {
  combos: Combo[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [desde, setDesde] = useState("00:00");
  const [hasta, setHasta] = useState("23:59");
  // Productos elegidos: id -> cantidad (texto del input).
  const [elegidos, setElegidos] = useState<Record<string, string>>({});
  const [aEliminar, setAEliminar] = useState<Combo | null>(null);

  const nombreDe = (id: string) =>
    productos.find((p) => p.id === id)?.nombre ?? "Producto";

  function alternarDia(d: number) {
    setDias((actual) =>
      actual.includes(d)
        ? actual.filter((x) => x !== d)
        : [...actual, d].sort(),
    );
  }

  function alternarProducto(id: string) {
    setElegidos((actual) => {
      const copia = { ...actual };
      if (id in copia) delete copia[id];
      else copia[id] = "1";
      return copia;
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const input: ComboInput = {
      nombre,
      precio: parseMonto(precio) ?? Number.NaN,
      dias,
      desde,
      hasta,
      items: Object.entries(elegidos).map(([productoId, cant]) => ({
        productoId,
        cantidad: Number(cant),
      })),
    };

    startTransition(async () => {
      const result = await crearCombo(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Combo creado", nombre);
      setNombre("");
      setPrecio("");
      setElegidos({});
      router.refresh();
    });
  }

  async function alternarActiva(combo: Combo) {
    const result = await cambiarActivaCombo(combo.id, !combo.activa);
    if (!result.ok) {
      toast.error("No se pudo cambiar el combo", result.error);
      return;
    }
    router.refresh();
  }

  async function confirmarEliminar(combo: Combo) {
    const result = await eliminarCombo(combo.id);
    if (!result.ok) {
      toast.error("No se pudo eliminar el combo", result.error);
      return;
    }
    toast.success("Combo eliminado", combo.nombre);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-6">
      <ConfirmDialog
        open={aEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null);
        }}
        title="¿Eliminar el combo?"
        description={`"${aEliminar?.nombre ?? ""}" deja de aplicarse. Las ventas ya hechas no cambian.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (aEliminar) void confirmarEliminar(aEliminar);
        }}
      />
      <Card className="gap-3">
        <CardEyebrow>Combos del comercio</CardEyebrow>
        {combos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay combos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {combos.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{c.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(c.precio)} ·{" "}
                    {c.items
                      .map((i) => `${i.cantidad} × ${nombreDe(i.productoId)}`)
                      .join(" + ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => alternarActiva(c)}
                  >
                    {c.activa ? "Pausar" : "Activar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAEliminar(c)}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-4">
        <CardEyebrow>Nuevo combo</CardEyebrow>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Coca + Pepsi"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Precio del combo
              <Input
                inputMode="decimal"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="5000"
                required
              />
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm">Productos del combo (mínimo 2)</legend>
            <ul className="grid max-h-64 gap-1 overflow-y-auto">
              {productos
                .filter((p) => p.activo || p.id in elegidos)
                .map((p) => {
                  const marcado = p.id in elegidos;
                  return (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${p.nombre}`}
                        checked={marcado}
                        onChange={() => alternarProducto(p.id)}
                      />
                      <span className="flex-1">{p.nombre}</span>
                      {marcado && (
                        <Input
                          aria-label={`Cantidad de ${p.nombre}`}
                          inputMode="numeric"
                          className="w-20"
                          value={elegidos[p.id]}
                          onChange={(e) =>
                            setElegidos((actual) => ({
                              ...actual,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </li>
                  );
                })}
            </ul>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm">Días de vigencia</legend>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((nombreDia, d) => (
                <Button
                  key={nombreDia}
                  type="button"
                  size="sm"
                  variant={dias.includes(d) ? "default" : "outline"}
                  aria-pressed={dias.includes(d)}
                  onClick={() => alternarDia(d)}
                >
                  {nombreDia}
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Desde
              <Input
                type="time"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Hasta
              <Input
                type="time"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending}>
            Creá el combo
          </Button>
        </form>
      </Card>
    </section>
  );
}
