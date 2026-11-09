"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buscarGuias, type Guia, type SeccionAyuda } from "../buscar";

const SECCIONES: { id: SeccionAyuda; titulo: string }[] = [
  { id: "mostrador", titulo: "Mostrador" },
  { id: "mercaderia", titulo: "Mercadería" },
  { id: "negocio", titulo: "Control del negocio" },
  { id: "administracion", titulo: "Administración" },
];

export function AyudaScreen({ guias }: { guias: readonly Guia[] }) {
  const [busqueda, setBusqueda] = useState("");
  const resultados = useMemo(
    () => buscarGuias(guias, busqueda),
    [guias, busqueda],
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Ayuda</h1>
        <p className="text-sm text-muted-foreground">
          Buscá lo que querés hacer y seguí los pasos.
        </p>
      </div>

      <Input
        type="search"
        aria-label="Buscá en la ayuda"
        placeholder="Por ejemplo: cerrar caja"
        autoComplete="off"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {resultados.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          No encontramos nada con esa búsqueda. Probá con otra palabra.
        </p>
      )}

      {SECCIONES.map((seccion) => {
        const delaSeccion = resultados.filter((g) => g.seccion === seccion.id);
        if (delaSeccion.length === 0) return null;
        return (
          <section
            key={seccion.id}
            aria-label={seccion.titulo}
            className="flex flex-col gap-2"
          >
            <h2 className="font-display text-lg font-bold">{seccion.titulo}</h2>
            <ul className="flex flex-col gap-2">
              {delaSeccion.map((guia) => (
                <li key={guia.id}>
                  <GuiaItem guia={guia} abierta={resultados.length === 1} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

function GuiaItem({ guia, abierta }: { guia: Guia; abierta: boolean }) {
  return (
    <Card className="gap-0 p-0">
      <details open={abierta} className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold">{guia.titulo}</span>
            <span className="text-sm text-muted-foreground">
              {guia.resumen}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
            {guia.pasos.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
          {guia.nota && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">{guia.nota}</p>
          )}
          <Link
            href={guia.ruta}
            className={cn(buttonVariants({ variant: "outline" }), "self-start")}
          >
            Ver en la pantalla
          </Link>
        </div>
      </details>
    </Card>
  );
}
