"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { registrarCompra, type CompraRegistrada } from "../actions";
import { costoFinal, margenSobrePrecio, totalCompra } from "../compras";
import type { Proveedor } from "../queries";
import type { CompraInput } from "../schemas";

export type ProductoCompra = {
  id: string;
  nombre: string;
  codigoBarras: string;
  costo: number | null;
};
type CajaOpcion = { id: string; nombre: string };

type Linea = {
  productoId: string;
  nombre: string;
  cantidad: string;
  costoLista: number | null;
  bonificacion: string;
  vencimiento: string;
};

type TipoPago = CompraInput["pago"]["tipo"];

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function numero(texto: string): number {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function CompraForm({
  proveedores,
  productos,
  cajas,
}: {
  proveedores: Pick<Proveedor, "id" | "nombre">[];
  productos: ProductoCompra[];
  cajas: CajaOpcion[];
}) {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoPago, setTipoPago] = useState<TipoPago>("fuera");
  const [cajaId, setCajaId] = useState(cajas[0]?.id ?? "");
  const [vencimientoPago, setVencimientoPago] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CompraRegistrada | null>(null);
  const [isPending, startTransition] = useTransition();

  const termino = busqueda.trim().toLowerCase();
  const resultados = useMemo(() => {
    if (!termino) return [];
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(termino) ||
          p.codigoBarras.includes(termino),
      )
      .slice(0, 8);
  }, [productos, termino]);

  const total = totalCompra(
    lineas.map((l) => ({
      cantidad: Math.trunc(numero(l.cantidad)),
      costoLista: l.costoLista ?? 0,
      bonificacionPct: numero(l.bonificacion),
    })),
  );

  function agregar(producto: ProductoCompra) {
    setBusqueda("");
    setError(null);
    setResultado(null);
    setLineas((prev) =>
      prev.some((l) => l.productoId === producto.id)
        ? prev
        : [
            ...prev,
            {
              productoId: producto.id,
              nombre: producto.nombre,
              cantidad: "1",
              costoLista: producto.costo,
              bonificacion: "",
              vencimiento: "",
            },
          ],
    );
  }

  function handleBuscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const porCodigo = productos.find((p) => p.codigoBarras === busqueda.trim());
    const elegido =
      porCodigo ?? (resultados.length === 1 ? resultados[0] : undefined);
    if (elegido) agregar(elegido);
  }

  function cambiar(productoId: string, cambios: Partial<Linea>) {
    setLineas((prev) =>
      prev.map((l) => (l.productoId === productoId ? { ...l, ...cambios } : l)),
    );
  }

  function confirmar() {
    if (isPending) return;
    setError(null);
    const pago: CompraInput["pago"] =
      tipoPago === "caja"
        ? { tipo: "caja", cajaId }
        : tipoPago === "fuera"
          ? { tipo: "fuera" }
          : { tipo: "por_pagar", vencimiento: vencimientoPago || null };
    startTransition(async () => {
      const result = await registrarCompra({
        proveedorId,
        comprobante,
        items: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad),
          costoLista: l.costoLista ?? 0,
          bonificacionPct: numero(l.bonificacion),
          vencimiento: l.vencimiento || null,
        })),
        pago,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Compra registrada", formatCurrency(result.data.total));
      setResultado(result.data);
      setLineas([]);
      setComprobante("");
      setVencimientoPago("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {resultado && resultado.suben.length > 0 && (
        <Card className="gap-2 p-4" role="status">
          <h2 className="font-semibold">Subieron estos costos</h2>
          <p className="text-xs text-muted-foreground">
            El precio de venta no cambió. Revisá si querés actualizarlo.
          </p>
          <ul
            aria-label="Costos que subieron"
            className="flex flex-col text-sm"
          >
            {resultado.suben.map((c) => (
              <li key={c.nombre} className="flex justify-between gap-3 py-1">
                <span className="min-w-0 break-words">{c.nombre}</span>
                <span className="shrink-0 tabular-nums">
                  Margen{" "}
                  {formatPercent(margenSobrePrecio(c.costoAnterior, c.precio))}{" "}
                  → {formatPercent(margenSobrePrecio(c.costoNuevo, c.precio))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Proveedor
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              className={selectClass}
            >
              <option value="">Elegí un proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Remito o factura (opcional)
            <Input
              value={comprobante}
              maxLength={60}
              onChange={(e) => setComprobante(e.target.value)}
            />
          </label>
        </div>

        <form onSubmit={handleBuscar} className="flex flex-col gap-2">
          <Input
            aria-label="Buscar producto para la compra"
            placeholder="Buscá por nombre o escaneá el código"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {resultados.length > 0 && (
            <ul className="divide-y rounded-md border">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => agregar(p)}
                    className="flex w-full items-center justify-between gap-3 p-2.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                  >
                    <span className="min-w-0 font-medium break-words">
                      {p.nombre}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {p.codigoBarras}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        {lineas.length > 0 && (
          <ul aria-label="Productos de la compra" className="flex flex-col">
            {lineas.map((l) => (
              <li
                key={l.productoId}
                className="flex flex-col gap-2 border-b border-border py-3 last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold break-words">
                    {l.nombre}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar ${l.nombre}`}
                    onClick={() =>
                      setLineas((prev) =>
                        prev.filter((x) => x.productoId !== l.productoId),
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Cantidad
                    <Input
                      aria-label={`Cantidad de ${l.nombre}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={l.cantidad}
                      onChange={(e) =>
                        cambiar(l.productoId, { cantidad: e.target.value })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Costo de lista
                    <MoneyInput
                      aria-label={`Costo de lista de ${l.nombre}`}
                      placeholder="0,00"
                      value={l.costoLista}
                      onValueChange={(valor) =>
                        cambiar(l.productoId, { costoLista: valor })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Bonificación %
                    <Input
                      aria-label={`Bonificación de ${l.nombre}`}
                      inputMode="decimal"
                      placeholder="0"
                      value={l.bonificacion}
                      onChange={(e) =>
                        cambiar(l.productoId, { bonificacion: e.target.value })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Vence el
                    <Input
                      aria-label={`Vencimiento de ${l.nombre}`}
                      type="date"
                      value={l.vencimiento}
                      onChange={(e) =>
                        cambiar(l.productoId, { vencimiento: e.target.value })
                      }
                    />
                  </label>
                </div>
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  Costo final{" "}
                  {formatCurrency(
                    costoFinal(l.costoLista ?? 0, numero(l.bonificacion)),
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Pago
            <select
              value={tipoPago}
              onChange={(e) => setTipoPago(e.target.value as TipoPago)}
              className={selectClass}
            >
              <option value="fuera">Pagada por fuera de la caja</option>
              <option value="caja" disabled={cajas.length === 0}>
                Pagada con una caja abierta
              </option>
              <option value="por_pagar">Por pagar</option>
            </select>
          </label>
          {tipoPago === "caja" && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Caja
              <select
                value={cajaId}
                onChange={(e) => setCajaId(e.target.value)}
                className={selectClass}
              >
                {cajas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          {tipoPago === "por_pagar" && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Vence el pago (opcional)
              <Input
                type="date"
                value={vencimientoPago}
                onChange={(e) => setVencimientoPago(e.target.value)}
              />
            </label>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl font-bold tabular-nums">
            Total {formatCurrency(total)}
          </p>
          <Button
            size="lg"
            disabled={isPending || lineas.length === 0}
            onClick={confirmar}
          >
            {isPending ? "Registrando..." : "Registrá la compra"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
