"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MedioPago } from "@/modules/config";
import type { Producto } from "@/modules/productos";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { registrarVentaDemo, type Comprobante } from "../actions";
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
  productosIniciales,
  mediosPago,
}: {
  productosIniciales: Producto[];
  mediosPago: MedioPago[];
}) {
  const [productos, setProductos] = useState(productosIniciales);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [medioPagoId, setMedioPagoId] = useState(mediosPago[0]?.id ?? "");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!comprobante) inputRef.current?.focus();
  }, [comprobante, cart.length]);

  const medioSeleccionado = mediosPago.find((m) => m.id === medioPagoId);
  const total = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const recibido = Number(montoRecibido.replace(",", "."));
  const vuelto =
    medioSeleccionado?.tipo === "efectivo" &&
    montoRecibido !== "" &&
    !Number.isNaN(recibido)
      ? recibido - total
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
    setMontoRecibido("");
    setError(null);
  }

  function cobrar() {
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
      (montoRecibido === "" || recibido < total)
    ) {
      setError("El monto recibido es menor al total");
      return;
    }

    startTransition(async () => {
      const result = await registrarVentaDemo({
        items: cart.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
        })),
        medioPagoId,
        montoRecibido:
          medioSeleccionado.tipo === "efectivo" ? recibido : undefined,
      });

      if (!result.ok) {
        setError(result.error);
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
      setCart([]);
      setMontoRecibido("");
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
  }, [cart, medioPagoId, montoRecibido, comprobante]);

  if (comprobante) {
    return (
      <ComprobanteView
        comprobante={comprobante}
        onNuevaVenta={() => setComprobante(null)}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Input
          ref={inputRef}
          autoFocus
          placeholder="Escaneá un código de barras o buscá por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleBuscarSubmit();
            }
          }}
          className="h-12 text-base"
        />

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="divide-y rounded-md border">
          {cart.length === 0 && (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Escaneá o buscá un producto para empezar la venta.
            </p>
          )}
          {cart.map((item) => (
            <div key={item.productoId} className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.nombre}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {formatCurrency(item.precio)} c/u
                </p>
              </div>
              <Input
                type="number"
                min={1}
                max={item.stockDisponible}
                value={item.cantidad}
                onChange={(e) =>
                  actualizarCantidad(item.productoId, Number(e.target.value))
                }
                className="w-16 text-center"
              />
              <p className="w-24 text-right text-sm font-medium tabular-nums">
                {formatCurrency(item.precio * item.cantidad)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => quitarDelCarrito(item.productoId)}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div>
          <p className="text-muted-foreground text-sm">Total</p>
          <p className="text-4xl font-light tracking-tight tabular-nums">
            {formatCurrency(total)}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Medio de pago</p>
          <div className="flex flex-wrap gap-2">
            {mediosPago.map((medio) => (
              <button
                key={medio.id}
                type="button"
                onClick={() => setMedioPagoId(medio.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  medio.id === medioPagoId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                {medio.nombre}
              </button>
            ))}
          </div>
        </div>

        {medioSeleccionado?.tipo === "efectivo" && (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="monto-recibido">
              Monto recibido
            </label>
            <Input
              id="monto-recibido"
              type="number"
              min={0}
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
            />
            {vuelto !== null && (
              <p
                className={cn(
                  "text-sm tabular-nums",
                  vuelto < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                Vuelto: {formatCurrency(Math.max(vuelto, 0))}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2 pt-2">
          <Button
            className="w-full"
            size="lg"
            disabled={isPending}
            onClick={cobrar}
          >
            Cobrar (F2)
          </Button>
          <Button
            className="w-full"
            variant="outline"
            disabled={isPending}
            onClick={cancelarVenta}
          >
            Cancelar (F4)
          </Button>
        </div>
      </div>
    </div>
  );
}
