"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BloqueControl } from "../control";
import { clavePeriodo, type Frecuencia } from "../periodo";

const PESTANAS: { id: Frecuencia; titulo: string; periodo: string }[] = [
  { id: "dia", titulo: "Todos los días", periodo: "hoy" },
  { id: "semana", titulo: "Por semana", periodo: "esta semana" },
  { id: "mes", titulo: "Por mes", periodo: "este mes" },
];

// Lo tildado se guarda en este navegador, por usuario y por período: es una ayuda para hacer la
// rutina, no un registro. Si el navegador no deja guardar, la lista funciona igual sin recordar.
const EVENTO = "control-diario";

function leer(clave: string): string {
  try {
    return localStorage.getItem(clave) ?? "{}";
  } catch {
    return "{}";
  }
}

function escribir(clave: string, valor: Record<string, boolean>) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento: lo tildado vale hasta recargar.
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

function parsear(texto: string): Record<string, boolean> {
  try {
    const valor: unknown = JSON.parse(texto);
    return valor && typeof valor === "object"
      ? (valor as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

export function ControlDiario({
  bloques,
  hoy,
  usuario,
}: {
  bloques: readonly BloqueControl[];
  hoy: string;
  usuario: string;
}) {
  const pestanas = PESTANAS.filter((p) =>
    bloques.some((b) => b.frecuencia === p.id),
  );
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("dia");
  const pestana = pestanas.find((p) => p.id === frecuencia) ?? pestanas[0];

  const clave = `control:${usuario}:${pestana.id}:${clavePeriodo(pestana.id, hoy)}`;
  const texto = useSyncExternalStore(
    suscribir,
    () => leer(clave),
    () => "{}",
  );
  const tildados = useMemo(() => parsear(texto), [texto]);

  const visibles = bloques.filter((b) => b.frecuencia === pestana.id);
  const ids = visibles.flatMap((b) => b.pasos.map((p) => `${b.id}.${p.id}`));
  const hechos = ids.filter((id) => tildados[id]).length;

  function alternar(id: string) {
    escribir(clave, { ...tildados, [id]: !tildados[id] });
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/ayuda"
          className="text-sm text-muted-foreground hover:underline"
        >
          Ayuda
        </Link>
        <h1 className="text-3xl">Control diario</h1>
        <p className="text-sm text-muted-foreground">
          La rutina para que el stock y la caja cierren bien. Tildá cada paso
          cuando lo hagas: lo tildado se guarda en este dispositivo y en el
          período siguiente arranca de cero.
        </p>
      </div>

      {pestanas.length > 1 && (
        <div
          role="tablist"
          aria-label="Cada cuánto"
          className="flex flex-wrap gap-2"
        >
          {pestanas.map((p) => (
            <Button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === pestana.id}
              variant={p.id === pestana.id ? "default" : "outline"}
              onClick={() => setFrecuencia(p.id)}
            >
              {p.titulo}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
            style={{
              width: `${ids.length ? (hechos / ids.length) * 100 : 0}%`,
            }}
          />
        </div>
        <p role="status" className="text-sm tabular-nums text-muted-foreground">
          {hechos} de {ids.length} {pestana.periodo}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={hechos === 0}
          onClick={() => escribir(clave, {})}
        >
          Destildá todo
        </Button>
      </div>

      {visibles.map((bloque) => (
        <section
          key={bloque.id}
          aria-label={bloque.titulo}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display text-lg font-bold">{bloque.titulo}</h2>
            <span className="text-sm text-muted-foreground">
              {bloque.quien} · {bloque.cuando}
            </span>
          </div>
          <Card className="gap-0 divide-y p-0">
            {bloque.pasos.map((paso) => {
              const id = `${bloque.id}.${paso.id}`;
              const hecho = !!tildados[id];
              return (
                <div key={id} className="flex items-start gap-3 p-4">
                  <input
                    id={`paso-${id}`}
                    type="checkbox"
                    checked={hecho}
                    onChange={() => alternar(id)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={`paso-${id}`}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded border-2",
                        hecho
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground",
                      )}
                    >
                      {hecho && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className={cn(
                          "font-semibold",
                          hecho && "text-muted-foreground line-through",
                        )}
                      >
                        {paso.titulo}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {paso.detalle}
                      </span>
                    </span>
                  </label>
                  {paso.ruta && (
                    <Link
                      href={paso.ruta}
                      aria-label={`Ir a la pantalla: ${paso.titulo}`}
                      className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <ChevronRight className="size-5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      ))}

      {pestana.id === "dia" && <SiAlgoNoCuadra />}
    </main>
  );
}

function SiAlgoNoCuadra() {
  return (
    <section
      aria-label="Si algo no cuadra"
      className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm"
    >
      <h2 className="font-display text-lg font-bold">Si algo no cuadra</h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        <li>
          Nada se carga con fecha pasada. Lo que no se registró ese día queda
          como diferencia en el cierre de ese día.
        </li>
        <li>
          Venta olvidada de un día ya cerrado: el stock se corrige con un ajuste
          en Stock, con la fecha y el monto en el motivo. La plata ya está en el
          sobrante de ese cierre.
        </li>
        <li>
          Retiro olvidado de un día ya cerrado: no se carga. El faltante de ese
          cierre es el retiro.
        </li>
        <li>
          Un retiro o ingreso cargado mal no se borra: se carga el movimiento
          contrario con su motivo.
        </li>
      </ul>
    </section>
  );
}
