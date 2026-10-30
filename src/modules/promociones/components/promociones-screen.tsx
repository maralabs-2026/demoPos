"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import type { Categoria, Producto } from "@/modules/productos";
import { cambiarActivaPromocion, crearPromocion } from "../actions";
import type { Promo } from "../logica";
import type { PromocionInput } from "../schemas";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TIPOS = {
  nxm: "Llevá y pagá (2x1, 3x2)",
  precio_cantidad: "Unidades a precio fijo (3 por $ 6.000)",
  porcentaje: "Descuento en %",
} as const;

function describirPromo(p: Promo): string {
  if (p.tipo === "nxm") return `Llevá ${p.lleva}, pagá ${p.paga}`;
  if (p.tipo === "precio_cantidad") {
    return `${p.cantidad} unidades a $ ${p.precio}`;
  }
  return `${p.porcentaje} % de descuento`;
}

const numero = (texto: string) =>
  texto.trim() === "" ? null : Number(texto.replace(",", "."));

export function PromocionesScreen({
  promos,
  productos,
  categorias,
}: {
  promos: Promo[];
  productos: Producto[];
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<keyof typeof TIPOS>("nxm");
  const [alcance, setAlcance] = useState<"producto" | "categoria">("producto");
  const [objetivo, setObjetivo] = useState("");
  const [lleva, setLleva] = useState("2");
  const [paga, setPaga] = useState("1");
  const [cantidad, setCantidad] = useState("3");
  const [precio, setPrecio] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [desde, setDesde] = useState("00:00");
  const [hasta, setHasta] = useState("23:59");

  function toggleDia(d: number) {
    setDias((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const input: PromocionInput = {
      nombre,
      tipo,
      alcance,
      productoId: alcance === "producto" && objetivo ? objetivo : null,
      categoriaId: alcance === "categoria" && objetivo ? objetivo : null,
      lleva: tipo === "nxm" ? numero(lleva) : null,
      paga: tipo === "nxm" ? numero(paga) : null,
      cantidad: tipo === "precio_cantidad" ? numero(cantidad) : null,
      precio: tipo === "precio_cantidad" ? numero(precio) : null,
      porcentaje: tipo === "porcentaje" ? numero(porcentaje) : null,
      dias,
      desde,
      hasta,
    };
    startTransition(async () => {
      const result = await crearPromocion(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Promo creada", nombre);
      setNombre("");
      setObjetivo("");
      router.refresh();
    });
  }

  async function cambiarActiva(p: Promo) {
    const result = await cambiarActivaPromocion(p.id, !p.activa);
    if (!result.ok) {
      toast.error("No se pudo cambiar la promo", result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
      <Card className="gap-3">
        <CardEyebrow>Promos del comercio</CardEyebrow>
        {promos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no hay promos. Creá la primera con el formulario.
          </p>
        )}
        <ul className="flex flex-col">
          {promos.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="font-semibold">{p.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {describirPromo(p)} ·{" "}
                  {p.alcance === "producto" ? "producto" : "categoría"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.dias.map((d) => DIAS[d]).join(" ")} · {p.desde.slice(0, 5)}{" "}
                  a {p.hasta.slice(0, 5)}
                </p>
              </div>
              <Button
                variant={p.activa ? "outline" : "secondary"}
                size="sm"
                onClick={() => cambiarActiva(p)}
              >
                {p.activa ? "Pausar" : "Activar"}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="gap-4">
        <CardEyebrow>Nueva promo</CardEyebrow>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Nombre
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej.: Coca 2x1 de los martes"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as keyof typeof TIPOS)}
              className="h-9 rounded-lg border border-input bg-card px-2 text-sm font-normal"
            >
              {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((t) => (
                <option key={t} value={t}>
                  {TIPOS[t]}
                </option>
              ))}
            </select>
          </label>

          {tipo === "nxm" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Llevá
                <Input
                  inputMode="numeric"
                  value={lleva}
                  onChange={(e) => setLleva(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Pagá
                <Input
                  inputMode="numeric"
                  value={paga}
                  onChange={(e) => setPaga(e.target.value)}
                />
              </label>
            </div>
          )}

          {tipo === "precio_cantidad" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Unidades
                <Input
                  inputMode="numeric"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Precio del grupo ($)
                <Input
                  inputMode="decimal"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                />
              </label>
            </div>
          )}

          {tipo === "porcentaje" && (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Porcentaje
              <Input
                inputMode="decimal"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Aplica a
              <select
                value={alcance}
                onChange={(e) => {
                  setAlcance(e.target.value as "producto" | "categoria");
                  setObjetivo("");
                }}
                className="h-9 rounded-lg border border-input bg-card px-2 text-sm font-normal"
              >
                <option value="producto">Un producto</option>
                <option value="categoria">Una categoría</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {alcance === "producto" ? "Producto" : "Categoría"}
              <select
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="h-9 rounded-lg border border-input bg-card px-2 text-sm font-normal"
              >
                <option value="">Elegí…</option>
                {alcance === "producto"
                  ? productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))
                  : categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
              </select>
            </label>
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-semibold">Días</legend>
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map((nombreDia, d) => (
                <button
                  key={nombreDia}
                  type="button"
                  aria-pressed={dias.includes(d)}
                  onClick={() => toggleDia(d)}
                  className={
                    "h-8 min-w-11 rounded-full border px-2 text-xs font-semibold " +
                    (dias.includes(d)
                      ? "border-primary bg-accent text-primary"
                      : "border-input bg-card")
                  }
                >
                  {nombreDia}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Desde
              <Input
                type="time"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Hasta
              <Input
                type="time"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Creá la promo"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
