"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ScanBarcode,
  Search,
  Split,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { CategoryTabs } from "@/components/ui/category-tabs";
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
import { resolverPagos, restantePorAsignar, type PagoParcial } from "../pagos";
import { ComprobanteView } from "./comprobante-view";

type CartItem = {
  productoId: string;
  nombre: string;
  precio: number;
  unidadVenta: string;
  cantidad: number;
  stockDisponible: number;
};

const TODAS = "Todos";

// Estado del stock como en el StockChip de Mostrador: al día, bajo el mínimo o sin stock.
function StockChip({ producto }: { producto: Producto }) {
  const sin = producto.stockActual <= 0;
  const bajo = !sin && producto.stockActual < producto.stockMinimo;
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 self-start rounded-full px-2 text-xs font-semibold tabular-nums",
        sin
          ? "bg-destructive-soft text-destructive"
          : bajo
            ? "bg-warning-soft text-warning-foreground"
            : "border border-border bg-card text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          sin ? "bg-destructive" : bajo ? "bg-warning" : "bg-success",
        )}
      />
      {sin
        ? "Sin stock"
        : bajo
          ? `Bajo · ${producto.stockActual}`
          : `Stock ${producto.stockActual}`}
    </span>
  );
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-current/30 px-1 font-mono text-[11px] font-semibold opacity-85">
      {children}
    </kbd>
  );
}

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
  const [categoria, setCategoria] = useState(TODAS);
  const [error, setError] = useState<string | null>(null);
  const [medioPagoId, setMedioPagoId] = useState(mediosPago[0]?.id ?? "");
  const [montoRecibido, setMontoRecibido] = useState<number | null>(null);
  // null = un solo medio de pago; con dos o más líneas, pago combinado.
  const [pagosCombinados, setPagosCombinados] = useState<PagoParcial[] | null>(
    null,
  );
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
    setPagosCombinados(null);
    setError(null);
  }

  // Atajos + y -: cambian la cantidad del último producto agregado.
  function cambiarCantidadUltimo(delta: 1 | -1) {
    const ultimo = cart[cart.length - 1];
    if (!ultimo) return;
    const nueva = ultimo.cantidad + delta;
    if (nueva < 1) return;
    if (nueva > ultimo.stockDisponible) {
      setError(`Solo quedan ${ultimo.stockDisponible} de "${ultimo.nombre}"`);
      return;
    }
    actualizarCantidad(ultimo.productoId, nueva);
    setError(null);
  }

  function dividirPago() {
    const otro = mediosPago.find((m) => m.id !== medioPagoId);
    if (!otro) return;
    setPagosCombinados([
      { key: crypto.randomUUID(), medioPagoId, monto: null },
      { key: crypto.randomUUID(), medioPagoId: otro.id, monto: null },
    ]);
    setError(null);
  }

  function agregarLineaPago() {
    setPagosCombinados((prev) => {
      if (!prev) return prev;
      const usados = new Set(prev.map((l) => l.medioPagoId));
      const libre = mediosPago.find((m) => !usados.has(m.id));
      if (!libre) return prev;
      return [
        ...prev,
        { key: crypto.randomUUID(), medioPagoId: libre.id, monto: null },
      ];
    });
  }

  function actualizarLineaPago(key: string, cambios: Partial<PagoParcial>) {
    setPagosCombinados((prev) =>
      prev ? prev.map((l) => (l.key === key ? { ...l, ...cambios } : l)) : prev,
    );
  }

  function quitarLineaPago(key: string) {
    setPagosCombinados((prev) => {
      if (!prev) return prev;
      const quedan = prev.filter((l) => l.key !== key);
      // Con una sola línea vuelve al pago simple, con ese medio.
      if (quedan.length < 2) {
        if (quedan[0]) setMedioPagoId(quedan[0].medioPagoId);
        return null;
      }
      return quedan;
    });
  }

  function cobrar() {
    // F2 no pasa por el botón deshabilitado: sin esto, un doble F2 registra la venta dos veces.
    if (isPending) return;
    if (cart.length === 0) {
      setError("El carrito está vacío");
      return;
    }
    const resueltos = resolverPagos(
      total,
      pagosCombinados
        ? { tipo: "combinado", pagos: pagosCombinados }
        : { tipo: "unico", medioPagoId, recibido: montoRecibido },
      mediosPago,
    );
    if (!resueltos.ok) {
      setError(resueltos.error);
      return;
    }

    startTransition(async () => {
      const result = await registrarVenta({
        cajaId,
        items: cart.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
        })),
        // Los montos suman el total de la pantalla: si un precio cambió en la base,
        // registrar_venta lo rechaza.
        pagos: resueltos.pagos,
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
      setPagosCombinados(null);
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
      } else if (e.key === "/" && e.target !== inputRef.current) {
        const target = e.target as HTMLElement | null;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        )
          return;
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "+" || e.key === "-") {
        // Solo con la búsqueda vacía (o fuera de un campo): "Coca-Cola" se tiene que poder escribir.
        const target = e.target as HTMLElement | null;
        const enCampo =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement;
        if (enCampo && !(target === inputRef.current && busqueda === ""))
          return;
        e.preventDefault();
        cambiarCantidadUltimo(e.key === "+" ? 1 : -1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cart,
    medioPagoId,
    montoRecibido,
    pagosCombinados,
    busqueda,
    comprobante,
    isPending,
  ]);

  const categorias = [
    TODAS,
    ...Array.from(
      new Set(
        productos
          .map((p) => p.categoriaNombre)
          .filter((c): c is string => Boolean(c)),
      ),
    ),
  ];
  const termino = busqueda.trim().toLowerCase();
  const catalogo = productos.filter(
    (p) =>
      (categoria === TODAS || p.categoriaNombre === categoria) &&
      (!termino ||
        p.nombre.toLowerCase().includes(termino) ||
        p.codigoBarras.includes(termino)),
  );

  if (comprobante) {
    return (
      <ComprobanteView
        comprobante={comprobante}
        onNuevaVenta={() => setComprobante(null)}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-4 pb-24 lg:pb-0">
      <section
        aria-label="Catálogo"
        className="flex min-w-0 flex-[999_1_560px] flex-col gap-3"
      >
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            autoFocus
            aria-label="Buscar producto"
            placeholder="Buscá por nombre o escaneá el código"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBuscarSubmit();
              }
            }}
            className="h-13 rounded-xl border-primary pr-12 pl-12 text-base shadow-[0_0_0_3px_var(--accent)] md:text-base"
          />
          <span className="absolute top-1/2 right-3 hidden -translate-y-1/2 text-muted-foreground sm:block">
            <KeyHint>/</KeyHint>
          </span>
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

        <CategoryTabs
          items={categorias.map((c) => ({ value: c, label: c }))}
          value={categoria}
          onValueChange={setCategoria}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
          {catalogo.map((producto) => {
            const sinStock = producto.stockActual <= 0;
            return (
              <button
                key={producto.id}
                type="button"
                aria-disabled={sinStock}
                onClick={() => {
                  agregarAlCarrito(producto);
                  inputRef.current?.focus();
                }}
                className={cn(
                  "flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-card p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  sinStock && "cursor-not-allowed opacity-55",
                )}
              >
                <StockChip producto={producto} />
                {producto.categoriaNombre && (
                  <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    {producto.categoriaNombre}
                  </span>
                )}
                <span className="line-clamp-2 min-h-[38px] text-sm leading-[19px] font-semibold">
                  {producto.nombre}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {producto.codigoBarras}
                </span>
                <span className="mt-0.5 flex items-end justify-between gap-2">
                  <span className="font-display text-lg leading-[22px] font-extrabold tabular-nums">
                    {formatCurrency(producto.precio, { decimals: 0 })}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-8 place-items-center rounded-lg",
                      sinStock
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    <Plus className="size-4" />
                  </span>
                </span>
              </button>
            );
          })}
          {catalogo.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No hay productos que coincidan con la búsqueda.
            </p>
          )}
        </div>
      </section>

      <Card
        id="ticket"
        aria-label="Ticket"
        className="w-full max-w-[420px] min-w-0 flex-[1_1_360px] gap-4 lg:sticky lg:top-6"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Ticket en curso</h2>
          <span className="text-xs text-muted-foreground">
            {cantidadItems === 1 ? "1 artículo" : `${cantidadItems} artículos`}
          </span>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <span className="grid size-12 place-items-center rounded-full bg-muted">
              <ScanBarcode aria-hidden="true" className="size-6" />
            </span>
            Escaneá o tocá un producto para empezar la venta.
          </div>
        ) : (
          <ul className="flex flex-col">
            {cart.map((item) => (
              <li
                key={item.productoId}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2.5 border-b border-border py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm leading-[19px] font-semibold">
                    {item.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(item.precio, { decimals: 0 })} c/u
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
                <p className="min-w-[72px] text-right font-display text-[15px] font-bold tabular-nums">
                  {formatCurrency(item.precio * item.cantidad, { decimals: 0 })}
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${item.nombre}`}
                  onClick={() => quitarDelCarrito(item.productoId)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {cart.length > 0 && (
          <p className="-mt-2 hidden text-xs text-muted-foreground sm:block">
            <KeyHint>+</KeyHint> <KeyHint>−</KeyHint> cambian la cantidad del
            último producto.
          </p>
        )}

        {pagosCombinados === null ? (
          <>
            <div
              role="group"
              aria-labelledby="medio-pago-label"
              className="flex flex-col gap-2"
            >
              <p id="medio-pago-label" className="text-sm font-semibold">
                Medio de pago
              </p>
              <div className="grid grid-cols-3 gap-2">
                {mediosPago.map((medio) => (
                  <button
                    key={medio.id}
                    type="button"
                    aria-pressed={medio.id === medioPagoId}
                    onClick={() => setMedioPagoId(medio.id)}
                    className={cn(
                      "min-h-11 rounded-[12px] border px-1.5 py-1 text-[13px] leading-tight font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
                      medio.id === medioPagoId
                        ? "border-primary bg-accent text-primary"
                        : "border-input bg-card hover:bg-muted",
                    )}
                  >
                    {medio.nombre}
                  </button>
                ))}
              </div>
            </div>

            {medioSeleccionado?.tipo === "efectivo" && (
              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-semibold"
                  htmlFor="monto-recibido"
                >
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
                        : "bg-success-soft text-success-text",
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

            {mediosPago.length > 1 && total > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={dividirPago}
              >
                <Split data-icon="inline-start" />
                Dividí el pago entre varios medios
              </Button>
            )}
          </>
        ) : (
          <div
            role="group"
            aria-labelledby="pago-combinado-label"
            className="flex flex-col gap-3"
          >
            <div className="flex items-baseline justify-between">
              <p id="pago-combinado-label" className="text-sm font-semibold">
                Pago combinado
              </p>
              <span className="text-xs text-muted-foreground">
                El efectivo se cobra justo
              </span>
            </div>
            {pagosCombinados.map((linea, index) => {
              const restante = restantePorAsignar(total, pagosCombinados);
              return (
                <div key={linea.key} className="flex items-center gap-2">
                  <select
                    aria-label={`Medio de pago ${index + 1}`}
                    value={linea.medioPagoId}
                    onChange={(e) =>
                      actualizarLineaPago(linea.key, {
                        medioPagoId: e.target.value,
                      })
                    }
                    className="h-10 w-32 shrink-0 rounded-lg border border-input bg-card px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {mediosPago.map((medio) => (
                      <option key={medio.id} value={medio.id}>
                        {medio.nombre}
                      </option>
                    ))}
                  </select>
                  <div className="min-w-0 flex-1">
                    <MoneyInput
                      aria-label={`Monto del medio ${index + 1}`}
                      placeholder={
                        restante > 0 && linea.monto === null
                          ? formatCurrency(restante).replace("$ ", "")
                          : "0,00"
                      }
                      value={linea.monto}
                      onValueChange={(monto) =>
                        actualizarLineaPago(linea.key, { monto })
                      }
                    />
                  </div>
                  {restante > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Completá el medio ${index + 1} con lo que falta`}
                      onClick={() =>
                        actualizarLineaPago(linea.key, {
                          monto:
                            Math.round(((linea.monto ?? 0) + restante) * 100) /
                            100,
                        })
                      }
                    >
                      Resto
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar el medio ${index + 1}`}
                    onClick={() => quitarLineaPago(linea.key)}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
            {(() => {
              const restante = restantePorAsignar(total, pagosCombinados);
              return (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm tabular-nums",
                    restante === 0
                      ? "bg-success-soft text-success-text"
                      : "bg-destructive-soft text-destructive",
                  )}
                >
                  <span>
                    {restante === 0
                      ? "Cubre el total"
                      : restante > 0
                        ? "Falta"
                        : "Sobra"}
                  </span>
                  {restante !== 0 && (
                    <strong className="text-base">
                      {formatCurrency(Math.abs(restante))}
                    </strong>
                  )}
                </div>
              );
            })()}
            {pagosCombinados.length < mediosPago.length && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={agregarLineaPago}
              >
                <Plus data-icon="inline-start" />
                Agregá otro medio
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted p-4">
          <div className="flex items-baseline justify-between text-sm text-muted-foreground tabular-nums">
            <span>Artículos</span>
            <span>{cantidadItems}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <CardEyebrow>Total</CardEyebrow>
            <p className="font-display text-[44px] leading-[48px] font-extrabold tracking-[-0.02em] tabular-nums">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            className="h-14 w-full rounded-2xl text-[17px] shadow-[0_6px_16px_rgba(15,122,85,0.28)] disabled:shadow-none"
            variant="success"
            size="lg"
            disabled={isPending}
            onClick={cobrar}
          >
            {isPending
              ? "Cobrando..."
              : total > 0
                ? `Cobrá ${formatCurrency(total, { decimals: 0 })}`
                : "Cobrá"}
            <KeyHint>F2</KeyHint>
          </Button>
          <Button
            className="w-full"
            variant="ghost"
            disabled={isPending}
            onClick={cancelarVenta}
          >
            Cancelá la venta
            <KeyHint>F4</KeyHint>
          </Button>
        </div>
      </Card>

      {/* Celular: el ticket queda debajo del catálogo; el total y el acceso al cobro quedan fijos
          arriba de la barra de módulos, como la hoja inferior del diseño. */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-card px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                {cantidadItems === 1
                  ? "1 artículo"
                  : `${cantidadItems} artículos`}
              </span>
              <span className="font-display text-2xl leading-7 font-extrabold tabular-nums">
                {formatCurrency(total, { decimals: 0 })}
              </span>
            </div>
            <Button
              variant="success"
              size="lg"
              onClick={() =>
                document
                  .getElementById("ticket")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              Ir a cobrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
