"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode, Search, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { QuickAmounts } from "@/components/ui/quick-amounts";
import { toast } from "@/components/ui/toaster";
import type { MedioPago } from "@/modules/config";
import type { Producto } from "@/modules/productos";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { registrarVenta, type Comprobante } from "../actions";
import { ComprobanteView } from "./comprobante-view";

type CartItem = {
  productoId: string;
  nombre: string;
  precio: number;
  unidadVenta: string;
  cantidad: number;
  stockDisponible: number;
};

export function VentaScreen({
  cajaId,
  productosIniciales,
  mediosPago,
}: {
  cajaId: string;
  productosIniciales: Producto[];
  mediosPago: MedioPago[];
}) {
  const router = useRouter();
  const [productos, setProductos] = useState(productosIniciales);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [medioPagoId, setMedioPagoId] = useState(mediosPago[0]?.id ?? "");
  const [montoRecibido, setMontoRecibido] = useState<number | null>(null);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!comprobante) inputRef.current?.focus();
  }, [comprobante, cart.length]);

  const medioSeleccionado = mediosPago.find((m) => m.id === medioPagoId);
  // Redondeado a centavos: sin esto, "Exacto" o un monto tipeado pueden quedar
  // por debajo de un total como 1234.5600000000002.
  const total =
    Math.round(cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0) * 100) /
    100;
  const cantidadItems = cart.reduce((acc, i) => acc + i.cantidad, 0);
  const vuelto =
    medioSeleccionado?.tipo === "efectivo" && montoRecibido !== null
      ? montoRecibido - total
      : null;

  function agregarAlCarrito(producto: Producto) {
    if (producto.stockActual <= 0) {
      setError(`"${producto.nombre}" no tiene stock`);
      return;
    }
    setCart((prev) => {
      const existente = prev.find((i) => i.productoId === producto.id);
      if (existente) {
        if (existente.cantidad + 1 > producto.stockActual) {
          setError(
            `Solo quedan ${producto.stockActual} de "${producto.nombre}"`,
          );
          return prev;
        }
        return prev.map((i) =>
          i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precio: producto.precio,
          unidadVenta: producto.unidadVenta,
          cantidad: 1,
          stockDisponible: producto.stockActual,
        },
      ];
    });
    setError(null);
  }

  function handleBuscarSubmit() {
    const term = busqueda.trim();
    if (!term) return;

    const porCodigo = productos.find((p) => p.codigoBarras === term);
    if (porCodigo) {
      agregarAlCarrito(porCodigo);
      setBusqueda("");
      return;
    }

    const termLower = term.toLowerCase();
    const porNombre = productos.filter((p) =>
      p.nombre.toLowerCase().includes(termLower),
    );
    if (porNombre.length === 1) {
      agregarAlCarrito(porNombre[0]);
      setBusqueda("");
      return;
    }
    if (porNombre.length > 1) {
      setError("Hay más de un producto que coincide. Usá el código de barras.");
      return;
    }
    setError(`No se encontró "${term}"`);
  }

  function actualizarCantidad(productoId: string, cantidad: number) {
    setCart((prev) =>
      prev.map((i) =>
        i.productoId === productoId
          ? {
              ...i,
              cantidad: Math.max(1, Math.min(cantidad, i.stockDisponible)),
            }
          : i,
      ),
    );
  }

  function quitarDelCarrito(productoId: string) {
    setCart((prev) => prev.filter((i) => i.productoId !== productoId));
  }

  function cancelarVenta() {
    setCart([]);
    setMontoRecibido(null);
    setError(null);
  }

  function cobrar() {
    // F2 no pasa por el botón deshabilitado: sin esto, un doble F2 registra la venta dos veces.
    if (isPending) return;
    if (cart.length === 0) {
      setError("El carrito está vacío");
      return;
    }
    if (!medioSeleccionado) {
      setError("Elegí un medio de pago");
      return;
    }
    if (
      medioSeleccionado.tipo === "efectivo" &&
      (montoRecibido === null || montoRecibido < total)
    ) {
      setError("El monto recibido es menor al total");
      return;
    }

    startTransition(async () => {
      const result = await registrarVenta({
        cajaId,
        items: cart.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
        })),
        // Un solo medio por ahora (los pagos combinados son la Fase 4b). El monto es el total
        // de la pantalla: si un precio cambió en la base, registrar_venta lo rechaza.
        pagos: [
          {
            medioPagoId,
            monto: total,
            recibido:
              medioSeleccionado.tipo === "efectivo"
                ? (montoRecibido ?? undefined)
                : undefined,
          },
        ],
      });

      if (!result.ok) {
        // También en pantalla: el toast se va a los 7 s y el cajero puede no verlo.
        setError(result.error);
        toast.error("No se pudo cobrar", result.error);
        // La caja se cerró en otro lado: la página vuelve a pedir que se abra.
        if (result.error.startsWith("Tu caja está cerrada")) router.refresh();
        return;
      }

      const vendido = new Map(cart.map((i) => [i.productoId, i.cantidad]));
      setProductos((prev) =>
        prev.map((p) =>
          vendido.has(p.id)
            ? { ...p, stockActual: p.stockActual - vendido.get(p.id)! }
            : p,
        ),
      );
      setComprobante(result.data);
      toast.success(
        "Venta registrada",
        `${formatCurrency(result.data.total)} · ${result.data.medioPagoNombre}`,
      );
      setCart([]);
      setMontoRecibido(null);
      setError(null);
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (comprobante) return;
      if (e.key === "F2") {
        e.preventDefault();
        cobrar();
      } else if (e.key === "F4") {
        e.preventDefault();
        cancelarVenta();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, medioPagoId, montoRecibido, comprobante, isPending]);

  if (comprobante) {
    return (
      <ComprobanteView
        comprobante={comprobante}
        onNuevaVenta={() => setComprobante(null)}
      />
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            autoFocus
            aria-label="Buscar producto"
            placeholder="Escaneá o buscá un producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBuscarSubmit();
              }
            }}
            className="h-13 rounded-full pl-12 text-base md:text-base"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
          >
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <Card className="gap-0">
          <CardHeader className="pb-2">
            <div>
              <CardEyebrow>Venta actual</CardEyebrow>
              <CardTitle className="mt-1">
                {cart.length === 1 ? "1 producto" : `${cart.length} productos`}
                {cantidadItems !== cart.length && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {cantidadItems} unidades
                  </span>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          {cart.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <span className="grid size-12 place-items-center rounded-full bg-muted">
                <ScanBarcode aria-hidden="true" className="size-6" />
              </span>
              Escaneá o buscá un producto para empezar la venta.
            </div>
          )}
          <ul className="flex flex-col">
            {cart.map((item) => (
              <li
                key={item.productoId}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-3 last:border-0"
              >
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                  <p className="truncate text-sm font-semibold">
                    {item.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(item.precio)} c/u
                  </p>
                </div>
                <QuantityStepper
                  value={item.cantidad}
                  max={item.stockDisponible}
                  label={item.nombre}
                  onDecrement={() =>
                    actualizarCantidad(item.productoId, item.cantidad - 1)
                  }
                  onIncrement={() =>
                    actualizarCantidad(item.productoId, item.cantidad + 1)
                  }
                  onValueChange={(n) => actualizarCantidad(item.productoId, n)}
                  onEnter={() => inputRef.current?.focus()}
                />
                <p className="ml-auto w-24 text-right text-sm font-bold tabular-nums">
                  {formatCurrency(item.precio * item.cantidad)}
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${item.nombre}`}
                  onClick={() => quitarDelCarrito(item.productoId)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="gap-5 lg:sticky lg:top-6">
        <div>
          <CardEyebrow>Total</CardEyebrow>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
            {formatCurrency(total)}
          </p>
        </div>

        <div
          role="group"
          aria-labelledby="medio-pago-label"
          className="flex flex-col gap-2"
        >
          <p id="medio-pago-label" className="text-sm font-semibold">
            Medio de pago
          </p>
          <div className="flex flex-wrap gap-2">
            {mediosPago.map((medio) => (
              <button
                key={medio.id}
                type="button"
                aria-pressed={medio.id === medioPagoId}
                onClick={() => setMedioPagoId(medio.id)}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
                  medio.id === medioPagoId
                    ? "border-primary bg-accent font-semibold text-primary"
                    : "border-border bg-card hover:border-foreground",
                )}
              >
                {medio.nombre}
              </button>
            ))}
          </div>
        </div>

        {medioSeleccionado?.tipo === "efectivo" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold" htmlFor="monto-recibido">
              Monto recibido
            </label>
            <MoneyInput
              id="monto-recibido"
              placeholder="0,00"
              value={montoRecibido}
              onValueChange={setMontoRecibido}
            />
            <QuickAmounts total={total} onSelect={setMontoRecibido} />
            {vuelto !== null && (
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm tabular-nums",
                  vuelto < 0
                    ? "bg-destructive-soft text-destructive"
                    : "bg-success-soft text-success-foreground",
                )}
              >
                <span>{vuelto < 0 ? "Falta" : "Vuelto"}</span>
                <strong className="text-base">
                  {formatCurrency(Math.abs(vuelto))}
                </strong>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full"
            size="lg"
            disabled={isPending}
            onClick={cobrar}
          >
            {isPending ? "Cobrando..." : "Cobrar"}
            <kbd className="rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-semibold">
              F2
            </kbd>
          </Button>
          <Button
            className="w-full"
            variant="outline"
            disabled={isPending}
            onClick={cancelarVenta}
          >
            Cancelar
            <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold">
              F4
            </kbd>
          </Button>
        </div>
      </Card>
    </div>
  );
}
