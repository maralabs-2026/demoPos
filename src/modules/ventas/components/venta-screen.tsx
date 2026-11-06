"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  ChevronRight,
  CreditCard,
  Plus,
  QrCode,
  ScanBarcode,
  Search,
  ShoppingBag,
  Split,
  Tag,
  TriangleAlert,
  UserRound,
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
import { FotoProducto } from "@/components/foto-producto";
import type { Producto } from "@/modules/productos";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { registrarVenta, type Comprobante } from "../actions";
import { resolverPagos, restantePorAsignar, type PagoParcial } from "../pagos";
import { calcularTotales, descuentoDeLinea } from "../totales";
import {
  aplicarCombos,
  ahoraEnCordoba,
  mejorPromo,
  type Combo,
  type Promo,
} from "@/modules/promociones";
import type { TicketTextos } from "../ticket";
import { ComprobanteView } from "./comprobante-view";

type CartItem = {
  productoId: string;
  nombre: string;
  categoriaId: string | null;
  precio: number;
  // Descuento de la línea en %, de 0 al tope del rol.
  descuentoPct: number;
  unidadVenta: string;
  cantidad: number;
  stockDisponible: number;
};

const TODAS = "Todos";

// Desde este ancho el ticket queda al costado; más chico, se abre como panel desde abajo.
const ESCRITORIO = "(min-width: 1024px)";

const ICONO_MEDIO = {
  efectivo: Banknote,
  tarjeta: CreditCard,
  transferencia: ArrowLeftRight,
  qr: QrCode,
  cuenta_corriente: UserRound,
} satisfies Record<MedioPago["tipo"], unknown>;

// Stock del celular: corto, con el mismo color de alerta que el StockChip.
function StockCorto({ producto }: { producto: Producto }) {
  const sin = producto.stockActual <= 0;
  const bajo = !sin && producto.stockActual < producto.stockMinimo;
  return (
    <span
      className={cn(
        "text-xs whitespace-nowrap tabular-nums lg:hidden",
        sin
          ? "font-semibold text-destructive"
          : bajo
            ? "font-semibold text-warning-foreground"
            : "text-muted-foreground",
      )}
    >
      {sin ? "Sin stock" : `${producto.stockActual} u.`}
    </span>
  );
}

// Estado del stock como en el StockChip de Mostrador: al día, bajo el mínimo o sin stock.
function StockChip({ producto }: { producto: Producto }) {
  const sin = producto.stockActual <= 0;
  const bajo = !sin && producto.stockActual < producto.stockMinimo;
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 self-start rounded-full px-2 text-xs font-semibold whitespace-nowrap tabular-nums",
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
    <kbd className="hidden h-5 min-w-5 items-center justify-center rounded-md border border-current/30 px-1 font-mono text-[11px] font-semibold lg:inline-flex">
      {children}
    </kbd>
  );
}

export function VentaScreen({
  cajaId,
  descuentoMaxPct,
  productosIniciales,
  mediosPago,
  promos,
  combos,
  horaServidorMs,
  ticketTextos,
  logoUrl,
}: {
  ticketTextos: TicketTextos;
  logoUrl: string | null;
  cajaId: string;
  // 100 para dueño y encargado; el tope de configuración para el cajero.
  descuentoMaxPct: number;
  productosIniciales: Producto[];
  mediosPago: MedioPago[];
  // Promos del comercio; se aplican solas, igual que en registrar_venta.
  promos: Promo[];
  // Combos fijos del comercio, en orden de creación (ver 0014).
  combos: Combo[];
  // Date.now() del servidor al armar la página.
  horaServidorMs: number;
}) {
  const router = useRouter();
  const [productos, setProductos] = useState(productosIniciales);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState(TODAS);
  const [descuentoTotalPct, setDescuentoTotalPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [medioPagoId, setMedioPagoId] = useState(mediosPago[0]?.id ?? "");
  const [montoRecibido, setMontoRecibido] = useState<number | null>(null);
  // null = un solo medio de pago; con dos o más líneas, pago combinado.
  const [pagosCombinados, setPagosCombinados] = useState<PagoParcial[] | null>(
    null,
  );
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [isPending, startTransition] = useTransition();
  const [desfaseRelojMs] = useState(() => horaServidorMs - Date.now());
  // Panel abierto en celular y tablet; en escritorio siempre es null.
  const [panel, setPanel] = useState<"carrito" | "cobro" | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const cerrarPanelRef = useRef<HTMLButtonElement>(null);

  // En una pantalla táctil, enfocar el buscador abre el teclado y tapa el catálogo.
  function enfocarBusqueda() {
    if (panel || window.matchMedia("(pointer: coarse)").matches) return;
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!comprobante) enfocarBusqueda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprobante, cart.length, panel]);

  // Con un panel abierto: el foco entra en él, la página de atrás no se desplaza, y si la ventana
  // pasa a escritorio se cierra, porque ahí el ticket ya está a la vista.
  useEffect(() => {
    if (!panel) return;
    cerrarPanelRef.current?.focus();
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escritorio = window.matchMedia(ESCRITORIO);
    const cerrarEnEscritorio = () => {
      if (escritorio.matches) setPanel(null);
    };
    escritorio.addEventListener("change", cerrarEnEscritorio);
    return () => {
      document.body.style.overflow = overflowPrevio;
      escritorio.removeEventListener("change", cerrarEnEscritorio);
    };
  }, [panel]);

  const medioSeleccionado = mediosPago.find((m) => m.id === medioPagoId);
  // Redondeado a centavos: sin esto, "Exacto" o un monto tipeado pueden quedar
  // por debajo de un total como 1234.5600000000002.
  // Mismo redondeo que registrar_venta: si no, el pago no coincidiría con el total de la base.
  // Combos y promos: mismo cálculo que registrar_venta (0013 y 0014). Primero los combos sobre el
  // ticket completo; después, la promo de mayor descuento sobre las unidades que no usó un combo.
  // La vigencia usa la hora del servidor: el reloj de la PC del kiosco puede estar desfasado.
  const ahora = ahoraEnCordoba(new Date(Date.now() + desfaseRelojMs));
  const combosPorLinea = aplicarCombos(
    cart.map((i) => ({
      productoId: i.productoId,
      categoriaId: i.categoriaId,
      precio: i.precio,
      cantidad: i.cantidad,
    })),
    combos,
    ahora,
  );
  const beneficioPorLinea = new Map(
    cart.map((i) => {
      const combo = combosPorLinea.get(i.productoId);
      const libres = i.cantidad - (combo?.consumido ?? 0);
      const promo =
        libres > 0
          ? mejorPromo(
              promos,
              {
                productoId: i.productoId,
                categoriaId: i.categoriaId,
                precio: i.precio,
                cantidad: libres,
              },
              ahora,
            )
          : null;
      const nombres = [
        ...(combo?.nombres ?? []),
        ...(promo ? [promo.nombre] : []),
      ];
      return [
        i.productoId,
        {
          comboDescuento: combo?.descuento ?? 0,
          promoDescuento: promo?.descuento ?? 0,
          nombre: nombres.join(" + "),
        },
      ] as const;
    }),
  );
  const totales = calcularTotales(
    cart.map((i) => ({
      ...i,
      comboDescuento: beneficioPorLinea.get(i.productoId)?.comboDescuento ?? 0,
      promoDescuento: beneficioPorLinea.get(i.productoId)?.promoDescuento ?? 0,
    })),
    descuentoTotalPct,
  );
  const total = totales.total;
  const descuentos = totales.descuentoItems + totales.descuentoTotal;
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
          categoriaId: producto.categoriaId,
          descuentoPct: 0,
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

  function porcentajeValido(texto: string): number {
    const pct = Number(texto.replace(",", "."));
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    if (pct > descuentoMaxPct) {
      setError(`Tu tope de descuento es ${descuentoMaxPct} %`);
      return descuentoMaxPct;
    }
    setError(null);
    return Math.round(pct * 100) / 100;
  }

  function cambiarDescuentoLinea(productoId: string, texto: string) {
    const pct = porcentajeValido(texto);
    setCart((prev) =>
      prev.map((i) =>
        i.productoId === productoId ? { ...i, descuentoPct: pct } : i,
      ),
    );
  }

  function quitarDelCarrito(productoId: string) {
    if (cart.length === 1) setPanel(null);
    setCart((prev) => prev.filter((i) => i.productoId !== productoId));
  }

  function cancelarVenta() {
    setPanel(null);
    setCart([]);
    setMontoRecibido(null);
    setPagosCombinados(null);
    setDescuentoTotalPct(0);
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
          descuentoPct: i.descuentoPct,
        })),
        descuentoPct: descuentoTotalPct,
        // Los montos suman el total de la pantalla: si un precio cambió en la base,
        // registrar_venta lo rechaza.
        pagos: resueltos.pagos,
      });

      if (!result.ok) {
        // También en pantalla: el toast se va a los 7 s y el cajero puede no verlo.
        setError(result.error);
        toast.error("No se pudo cobrar", result.error);
        // La caja se cerró en otro lado: la página vuelve a pedir que se abra.
        // El total cambió: trae promos y combos al día sin perder el carrito.
        if (
          result.error.startsWith("Tu caja está cerrada") ||
          result.error.startsWith("El total cambió")
        ) {
          router.refresh();
        }
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
      setPanel(null);
      toast.success(
        "Venta registrada",
        `${formatCurrency(result.data.total)} · ${result.data.medioPagoNombre}`,
      );
      setCart([]);
      setMontoRecibido(null);
      setPagosCombinados(null);
      setDescuentoTotalPct(0);
      setError(null);
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (comprobante) return;
      if (e.key === "Escape" && panel) {
        setPanel(null);
      } else if (e.key === "F2") {
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
    panel,
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
        textos={ticketTextos}
        logoUrl={logoUrl}
        onNuevaVenta={() => setComprobante(null)}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-4 pb-28 lg:pb-0">
      <section
        aria-label="Catálogo"
        inert={panel !== null}
        className="flex min-w-0 flex-[999_1_560px] flex-col gap-3"
      >
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={inputRef}
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
            className="h-13 rounded-xl border-primary pr-3 pl-12 text-base sm:pr-12 shadow-[0_0_0_3px_var(--accent)] md:text-base"
          />
          <span className="absolute top-1/2 right-3 hidden -translate-y-1/2 text-muted-foreground sm:block">
            <KeyHint>/</KeyHint>
          </span>
        </div>

        {error && !panel && (
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
            const enTicket =
              cart.find((i) => i.productoId === producto.id)?.cantidad ?? 0;
            return (
              <button
                key={producto.id}
                type="button"
                aria-disabled={sinStock}
                onClick={() => {
                  agregarAlCarrito(producto);
                  // Cierra el teclado si estaba buscando; en escritorio el foco vuelve enseguida.
                  inputRef.current?.blur();
                  enfocarBusqueda();
                }}
                className={cn(
                  "relative flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-card p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  enTicket > 0 &&
                    "border-primary ring-1 ring-primary hover:border-primary",
                  sinStock && "cursor-not-allowed opacity-55",
                )}
              >
                <FotoProducto
                  src={producto.fotoUrl}
                  entera
                  className="mb-1 h-28 w-full lg:h-32"
                />
                <span className="absolute top-2 right-2 hidden lg:block">
                  <StockChip producto={producto} />
                </span>
                {enTicket > 0 && (
                  <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground tabular-nums lg:right-auto lg:left-2">
                    <span className="sr-only">En el ticket: </span>
                    {enTicket}
                  </span>
                )}
                {producto.categoriaNombre && (
                  <span className="hidden text-[11px] font-bold tracking-wide text-muted-foreground uppercase lg:block">
                    {producto.categoriaNombre}
                  </span>
                )}
                <span className="line-clamp-2 min-h-[38px] text-sm leading-[19px] font-semibold">
                  {producto.nombre}
                </span>
                <span className="hidden font-mono text-xs text-muted-foreground lg:block">
                  {producto.codigoBarras}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2 lg:items-end">
                  <span className="font-display text-lg leading-[22px] font-extrabold tabular-nums">
                    {formatCurrency(producto.precio, { decimals: 0 })}
                  </span>
                  <StockCorto producto={producto} />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "hidden size-8 place-items-center rounded-lg lg:grid",
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

      {panel && (
        <div
          aria-hidden="true"
          onClick={() => setPanel(null)}
          className="fixed inset-0 z-50 bg-foreground/40 lg:hidden"
        />
      )}

      {/* Un solo ticket: al costado en escritorio; en celular y tablet, panel desde abajo con dos
          vistas, carrito y cobro. Sin panel abierto, ahí queda solo la barra flotante. */}
      <Card
        id="ticket"
        aria-label="Ticket"
        role={panel ? "dialog" : undefined}
        aria-modal={panel ? true : undefined}
        className={cn(
          "w-full min-w-0 gap-2.5 p-4 lg:static lg:flex lg:max-h-none lg:max-w-[460px] lg:flex-[1_1_360px] lg:overflow-visible lg:rounded-xl",
          panel
            ? "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl rounded-b-none pb-[calc(1rem+env(safe-area-inset-bottom))]"
            : "hidden",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">
            <span className="lg:hidden">
              {panel === "cobro" ? "Cobrar" : "Ticket en curso"}
            </span>
            <span className="hidden lg:inline">Ticket en curso</span>
          </h2>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs text-muted-foreground",
                panel === "cobro" && "hidden lg:inline",
              )}
            >
              {cantidadItems === 1
                ? "1 artículo"
                : `${cantidadItems} artículos`}
            </span>
            {panel && (
              <Button
                ref={cerrarPanelRef}
                variant="secondary"
                size="icon-sm"
                aria-label="Cerrar"
                className="rounded-full lg:hidden"
                onClick={() => setPanel(null)}
              >
                <X />
              </Button>
            )}
          </span>
        </div>

        {error && panel && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-2 text-sm font-medium text-destructive"
          >
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Total grande arriba del cobro en celular; en escritorio y en el carrito va más abajo. */}
        {panel === "cobro" && (
          <div className="py-1 text-center lg:hidden">
            <p className="text-sm text-muted-foreground">Total a cobrar</p>
            <p className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] tabular-nums">
              {formatCurrency(total)}
            </p>
            {descuentos > 0 && (
              <p className="text-sm font-semibold text-success-text tabular-nums">
                Con − {formatCurrency(descuentos)} de descuento
              </p>
            )}
          </div>
        )}

        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <span className="grid size-12 place-items-center rounded-full bg-muted">
              <ScanBarcode aria-hidden="true" className="size-6" />
            </span>
            Escaneá o tocá un producto para empezar la venta.
          </div>
        ) : (
          <ul
            className={cn(
              "flex flex-col",
              panel === "cobro" && "hidden lg:flex",
            )}
          >
            {cart.map((item) => {
              const beneficio = beneficioPorLinea.get(item.productoId);
              const bruto = item.precio * item.cantidad;
              const descuentoLinea = descuentoDeLinea({
                ...item,
                comboDescuento: beneficio?.comboDescuento ?? 0,
                promoDescuento: beneficio?.promoDescuento ?? 0,
              });
              return (
                <li
                  key={item.productoId}
                  className="flex flex-col gap-1.5 border-b border-border py-2.5 last:border-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 min-w-0 text-sm leading-[19px] font-semibold">
                      {item.nombre}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${item.nombre}`}
                      className="-mt-1 -mr-1 shrink-0"
                      onClick={() => quitarDelCarrito(item.productoId)}
                    >
                      <X />
                    </Button>
                  </div>
                  {beneficio?.nombre && (
                    <p className="flex items-start gap-1.5 self-start rounded-md bg-success-soft px-2 py-1 text-xs leading-4 font-semibold text-success-text">
                      <Tag
                        aria-hidden="true"
                        className="mt-0.5 size-3 shrink-0"
                      />
                      <span className="min-w-0 break-words">
                        Promo: {beneficio.nombre}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {formatCurrency(item.precio, { decimals: 0 })} c/u
                    </span>
                    <label className="flex items-center gap-1">
                      Desc.
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Descuento de ${item.nombre} en porcentaje`}
                        placeholder="0"
                        value={item.descuentoPct || ""}
                        onChange={(e) =>
                          cambiarDescuentoLinea(item.productoId, e.target.value)
                        }
                        className="h-6 w-11 rounded-md border border-input bg-card px-1.5 text-right text-xs tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      />
                      %
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
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
                      onValueChange={(n) =>
                        actualizarCantidad(item.productoId, n)
                      }
                      onEnter={enfocarBusqueda}
                    />
                    <p className="text-right font-display text-[15px] font-bold tabular-nums">
                      {descuentoLinea > 0 && (
                        <span className="block text-xs font-medium text-muted-foreground line-through">
                          {formatCurrency(bruto, { decimals: 0 })}
                        </span>
                      )}
                      {formatCurrency(bruto - descuentoLinea)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Vista de cobro: en el carrito del celular se oculta. */}
        <div
          className={cn(
            "flex flex-col gap-2.5",
            panel === "carrito" && "hidden lg:flex",
          )}
        >
          {pagosCombinados === null ? (
            <>
              <div
                role="group"
                aria-labelledby="medio-pago-label"
                className="flex flex-col gap-1.5"
              >
                <p id="medio-pago-label" className="text-sm font-semibold">
                  Medio de pago
                </p>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-1.5">
                  {mediosPago.map((medio) => {
                    const Icono = ICONO_MEDIO[medio.tipo];
                    return (
                      <button
                        key={medio.id}
                        type="button"
                        aria-pressed={medio.id === medioPagoId}
                        onClick={() => setMedioPagoId(medio.id)}
                        className={cn(
                          "flex h-13 items-center gap-2 rounded-xl border px-3 text-left text-sm leading-tight font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none lg:h-9 lg:justify-center lg:rounded-[10px] lg:px-1 lg:text-center lg:text-xs",
                          medio.id === medioPagoId
                            ? "border-primary bg-accent text-primary"
                            : "border-input bg-card hover:bg-muted",
                        )}
                      >
                        <Icono
                          aria-hidden="true"
                          className="size-5 shrink-0 lg:hidden"
                        />
                        {medio.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {medioSeleccionado?.tipo === "efectivo" && (
                <div className="flex flex-col gap-1.5">
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
                        "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm tabular-nums",
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
                              Math.round(
                                ((linea.monto ?? 0) + restante) * 100,
                              ) / 100,
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
        </div>

        {cart.length > 0 && (
          <div
            className={cn(
              "flex flex-col",
              panel === "cobro" && "hidden lg:flex",
            )}
          >
            <label
              htmlFor="descuento-total"
              className="flex items-center justify-between gap-3 text-sm font-semibold"
            >
              Descuento sobre el total
              <span className="flex items-center gap-1 font-normal text-muted-foreground">
                <input
                  id="descuento-total"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={descuentoTotalPct || ""}
                  onChange={(e) =>
                    setDescuentoTotalPct(porcentajeValido(e.target.value))
                  }
                  className="h-9 w-16 rounded-lg border border-input bg-card px-2 text-right text-sm text-foreground tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
                %
              </span>
            </label>
          </div>
        )}

        <div
          className={cn(
            "flex flex-col gap-1 rounded-2xl border border-border bg-muted px-4 py-3",
            panel === "cobro" && "hidden lg:flex",
          )}
        >
          {descuentos > 0 && (
            <>
              <div className="flex items-baseline justify-between text-sm text-muted-foreground tabular-nums">
                <span>Subtotal</span>
                <span>{formatCurrency(totales.bruto)}</span>
              </div>
              <div className="flex items-baseline justify-between text-sm font-semibold text-success-text tabular-nums">
                <span>Descuentos</span>
                <span>− {formatCurrency(descuentos)}</span>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <CardEyebrow>Total</CardEyebrow>
            <p className="font-display text-[36px] leading-[40px] font-extrabold tracking-[-0.02em] tabular-nums">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-col gap-1.5 bg-card px-4 pt-2 pb-4 lg:static lg:m-0 lg:p-0">
          {/* En el carrito del celular se pasa al cobro antes de confirmar. */}
          <Button
            className={cn(
              "h-12 w-full rounded-2xl text-[16px] lg:hidden",
              panel !== "carrito" && "hidden",
            )}
            variant="success"
            size="lg"
            onClick={() => setPanel("cobro")}
          >
            Seguí al cobro
            <ChevronRight data-icon="inline-end" />
          </Button>
          <Button
            className={cn(
              "h-12 w-full rounded-2xl text-[16px] shadow-[0_6px_16px_rgba(15,122,85,0.28)] disabled:shadow-none",
              panel === "carrito" && "hidden lg:inline-flex",
            )}
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
            className={cn(
              "h-9 w-full",
              panel === "cobro" && "hidden lg:inline-flex",
            )}
            variant="ghost"
            disabled={isPending}
            onClick={cancelarVenta}
          >
            Cancelá la venta
            <KeyHint>F4</KeyHint>
          </Button>
        </div>
      </Card>

      {/* Celular y tablet: barra flotante arriba de la navegación, con el carrito y el cobro. */}
      {cart.length > 0 && (
        <div
          inert={panel !== null}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl items-center justify-between gap-2 rounded-2xl bg-primary p-2 text-primary-foreground shadow-[0_8px_24px_rgba(15,23,42,0.28)] lg:hidden"
        >
          <button
            type="button"
            onClick={() => setPanel("carrito")}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:outline-none"
          >
            <span className="relative shrink-0">
              <ShoppingBag aria-hidden="true" className="size-6" />
              <span className="absolute -top-2 -right-2 grid h-5 min-w-5 place-items-center rounded-full bg-card px-1 text-xs font-bold text-primary tabular-nums">
                <span className="sr-only">Artículos: </span>
                {cantidadItems}
              </span>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-xs opacity-85">Ver carrito</span>
              <span className="truncate font-display text-xl leading-6 font-extrabold tabular-nums">
                {formatCurrency(total, { decimals: 0 })}
              </span>
            </span>
          </button>
          <Button
            variant="secondary"
            size="lg"
            className="h-11 shrink-0 rounded-xl bg-card text-primary hover:bg-card"
            onClick={() => setPanel("cobro")}
          >
            Cobrá
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      )}
    </div>
  );
}
