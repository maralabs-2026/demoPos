"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoryTabs } from "@/components/ui/category-tabs";
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { QuickAmounts } from "@/components/ui/quick-amounts";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/currency";

const colors = [
  { token: "primary", hex: "#315cf5", use: "Acciones principales" },
  { token: "primary-hover", hex: "#2347ce", use: "Hover de acciones" },
  { token: "accent", hex: "#edf1ff", use: "Fondo activo, foco" },
  { token: "success", hex: "#b8f72c", use: "Confirmaciones" },
  { token: "success-soft", hex: "#efffc8", use: "Estado ok" },
  { token: "warning", hex: "#ff9d56", use: "Advertencias" },
  { token: "warning-soft", hex: "#fff0e3", use: "Stock bajo" },
  { token: "destructive", hex: "#d93b3b", use: "Errores, sin stock" },
  { token: "foreground", hex: "#171918", use: "Texto" },
  { token: "muted-foreground", hex: "#6f746f", use: "Texto secundario" },
  { token: "border", hex: "#dfe2dc", use: "Bordes" },
  { token: "background", hex: "#f3f4ef", use: "Fondo de la app" },
] as const;

const radii = [
  { label: "sm", className: "rounded-sm" },
  { label: "lg", className: "rounded-lg" },
  { label: "xl", className: "rounded-xl" },
  { label: "2xl", className: "rounded-2xl" },
] as const;

const categorias = [
  { value: "todas", label: "Todas" },
  { value: "golosinas", label: "Golosinas" },
  { value: "bebidas", label: "Bebidas" },
  { value: "almacen", label: "Almacén" },
] as const;

type Categoria = (typeof categorias)[number]["value"];

const items = [
  { id: "1", nombre: "Alfajor Guaymallén triple", precio: 650 },
  { id: "2", nombre: "Coca-Cola 500 ml", precio: 1800 },
  { id: "3", nombre: "Yerba Playadito 1 kg", precio: 4950 },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 border-b border-border py-10"
    >
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function UiKitDemo() {
  const [categoria, setCategoria] = useState<Categoria>("todas");
  const [cantidades, setCantidades] = useState<Record<string, number>>({
    "1": 2,
    "2": 1,
    "3": 1,
  });
  const [monto, setMonto] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const total = items.reduce((t, i) => t + i.precio * cantidades[i.id], 0);

  function cambiar(id: string, delta: number) {
    setCantidades((c) => ({ ...c, [id]: Math.max(1, c[id] + delta) }));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-8">
      <header className="flex flex-col gap-3 border-b border-border py-10">
        <Badge variant="success" dot>
          Solo desarrollo y preview
        </Badge>
        <h1 className="text-4xl sm:text-5xl">
          UI kit del <span className="text-primary">punto de venta</span>
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Referencia viva de tokens y componentes de{" "}
          <code>src/components/ui</code>. Si algo se ve mal acá, se ve mal en
          toda la app.
        </p>
      </header>

      <Section id="colores" title="Colores">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {colors.map((c) => (
            <div
              key={c.token}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div
                className="h-16"
                style={{ background: `var(--${c.token})` }}
              />
              <div className="flex flex-col gap-0.5 p-3 text-xs">
                <strong>{c.token}</strong>
                <span className="text-muted-foreground">
                  {c.hex} · {c.use}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tipografia" title="Tipografía · DM Sans">
        <Card>
          <p className="text-5xl font-semibold tracking-tight">$ 7.450,00</p>
          <p className="text-2xl font-semibold tracking-tight">
            Título de pantalla
          </p>
          <p className="text-lg font-semibold">Título de tarjeta</p>
          <p>Texto de cuerpo para descripciones y formularios.</p>
          <p className="text-sm text-muted-foreground">
            Texto secundario y ayudas.
          </p>
          <CardEyebrow>Rótulo en mayúsculas</CardEyebrow>
        </Card>
      </Section>

      <Section id="radios" title="Radios">
        <div className="flex flex-wrap gap-3">
          {radii.map((r) => (
            <div
              key={r.label}
              className={`grid size-20 place-items-center border border-primary/30 bg-accent text-xs font-bold text-primary ${r.className}`}
            >
              {r.label}
            </div>
          ))}
        </div>
      </Section>

      <Section id="botones" title="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            Cobrar <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant="outline">Cancelar</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="success">Confirmar</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2 data-icon="inline-start" /> Quitar
          </Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button>default</Button>
          <Button size="lg">lg</Button>
          <Button size="icon" aria-label="Agregar">
            <Plus />
          </Button>
          <Button size="icon" variant="outline" aria-label="Buscar">
            <Search />
          </Button>
          <Button disabled>Deshabilitado</Button>
          <Button variant="outline" disabled>
            Deshabilitado
          </Button>
        </div>
      </Section>

      <Section id="inputs" title="Inputs">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Buscar producto
            <Input placeholder="Escaneá o escribí un producto" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Con error
            <Input aria-invalid defaultValue="abc" />
            <span className="text-xs font-normal text-destructive">
              Ingresá un monto válido.
            </span>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Deshabilitado
            <Input disabled defaultValue="No editable" />
          </label>
        </div>
      </Section>

      <Section id="badges" title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge variant="success" dot>
            Stock ok
          </Badge>
          <Badge variant="warning" dot>
            Bajo mínimo
          </Badge>
          <Badge variant="destructive" dot>
            Sin stock
          </Badge>
          <Badge variant="info" dot>
            Caja abierta
          </Badge>
          <Badge>Neutral</Badge>
        </div>
      </Section>

      <Section id="controles" title="Cantidad y categorías">
        <div className="flex flex-wrap items-center gap-4">
          <QuantityStepper
            size="lg"
            value={cantidades["1"]}
            onDecrement={() => cambiar("1", -1)}
            onIncrement={() => cambiar("1", 1)}
            label={items[0].nombre}
          />
          <QuantityStepper
            value={cantidades["1"]}
            onDecrement={() => cambiar("1", -1)}
            onIncrement={() => cambiar("1", 1)}
            label={items[0].nombre}
          />
        </div>
        <CategoryTabs
          items={categorias}
          value={categoria}
          onValueChange={setCategoria}
        />
      </Section>

      <Section id="montos" title="Montos">
        <div className="flex max-w-sm flex-col gap-2">
          <label htmlFor="demo-monto" className="text-sm font-semibold">
            Monto recibido · total {formatCurrency(total)}
          </label>
          <MoneyInput
            id="demo-monto"
            placeholder="0,00"
            value={monto}
            onValueChange={setMonto}
          />
          <QuickAmounts total={total} onSelect={setMonto} />
          <span className="text-xs text-muted-foreground">
            Valor entregado: <code>{JSON.stringify(monto)}</code>
          </span>
        </div>
      </Section>

      <Section id="avisos" title="Avisos">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() =>
              toast.success(
                "Venta registrada",
                `${formatCurrency(total)} · Efectivo`,
              )
            }
          >
            Éxito
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.error(
                "Sin stock suficiente",
                "Quedan 0 unidades de Coca-Cola 500 ml.",
              )
            }
          >
            Error
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info("Caja abierta", "Monto inicial $ 5.000")}
          >
            Info
          </Button>
        </div>
      </Section>

      <Section id="ventanas" title="Ventanas">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
              Aplicar descuento
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Descuento sobre el total</DialogTitle>
                <DialogDescription>
                  En celular se abre desde abajo; Esc o la X la cierran.
                </DialogDescription>
              </DialogHeader>
              <MoneyInput
                aria-label="Monto del descuento"
                value={null}
                onValueChange={() => {}}
              />
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancelar
                </DialogClose>
                <DialogClose render={<Button />}>Aplicar</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => setConfirmar(true)}>
            Cancelar venta
          </Button>
          <ConfirmDialog
            open={confirmar}
            onOpenChange={setConfirmar}
            title="¿Cancelar la venta?"
            description="Se quitan los 3 productos del carrito."
            confirmLabel="Sí, cancelar venta"
            cancelLabel="Volver"
            destructive
            onConfirm={() => toast.info("Venta cancelada")}
          />
        </div>
      </Section>

      <Section id="patrones" title="Patrones">
        <div className="grid items-start gap-4 md:grid-cols-[1fr_1.4fr]">
          <Card className="gap-0 p-0">
            <div className="grid h-36 place-items-center rounded-t-xl bg-muted text-muted-foreground">
              <ShoppingBag className="size-10" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1 p-5">
              <Badge variant="warning" dot>
                Bajo mínimo
              </Badge>
              <CardTitle className="mt-2">Yerba Playadito 1 kg</CardTitle>
              <span className="text-xs text-muted-foreground">
                Almacén · 7790387000014
              </span>
              <div className="mt-3 flex items-center justify-between">
                <strong className="text-lg">{formatCurrency(4950)}</strong>
                <Button size="icon-sm" aria-label="Agregar a la venta">
                  <Plus />
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Venta actual</CardEyebrow>
                <CardTitle className="mt-1">3 productos</CardTitle>
              </div>
              <Badge variant="info" dot>
                Caja 1
              </Badge>
            </CardHeader>
            <CardContent className="gap-0">
              {items.map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
                >
                  <div className="flex flex-col">
                    <strong className="text-sm">{i.nombre}</strong>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(i.precio)} c/u
                    </span>
                  </div>
                  <QuantityStepper
                    value={cantidades[i.id]}
                    onDecrement={() => cambiar(i.id, -1)}
                    onIncrement={() => cambiar(i.id, 1)}
                    label={i.nombre}
                  />
                </div>
              ))}
            </CardContent>
            <CardFooter className="border-0 pt-0">
              <span className="text-muted-foreground">Total</span>
              <strong className="text-3xl tracking-tight tabular-nums">
                {formatCurrency(total)}
              </strong>
            </CardFooter>
            <Button size="lg" className="w-full">
              Cobrar (F2) <ArrowRight data-icon="inline-end" />
            </Button>
          </Card>
        </div>
      </Section>
    </main>
  );
}
