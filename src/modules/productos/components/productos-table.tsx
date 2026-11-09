"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PackagePlus, Search, Tag, Trash2 } from "lucide-react";
import { FotoProducto } from "@/components/foto-producto";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/currency";
import { eliminarProducto } from "../actions";
import type { Categoria, Producto } from "../queries";
import { calcularMargen } from "../schemas";
import {
  contarPorFiltroStock,
  estadoStock,
  parseFiltroStock,
  pasaFiltroStock,
  type FiltroStock,
} from "../stock-filtro";
import { EtiquetasDialog } from "./etiquetas-dialog";
import { ProductoForm, type ProveedorOpcion } from "./producto-form";

function StockCell({ producto }: { producto: Producto }) {
  const estado = estadoStock(producto);
  if (estado === "servicio") {
    return <Badge>Servicio</Badge>;
  }
  const stock = `${producto.stockActual} ${producto.unidadVenta}`;
  if (estado === "sin_stock") {
    return (
      <Badge variant="destructive" dot>
        Sin stock
      </Badge>
    );
  }
  // Bajo mínimo en rojo, como pide la Fase D (no naranja).
  if (estado === "bajo_minimo") {
    return (
      <Badge variant="destructive" dot className="whitespace-normal">
        {stock} · bajo mínimo
      </Badge>
    );
  }
  return <span className="tabular-nums">{stock}</span>;
}

// Debajo de xl no entran las columnas (la barra lateral ocupa 240 px): cada fila es una tarjeta.
// Es la misma tabla con otro CSS: una sola copia de cada producto en el DOM. El rótulo va en
// ::before para que no exista en la vista de escritorio.
const DATO_TARJETA =
  "max-xl:flex max-xl:min-w-0 max-xl:flex-col max-xl:items-start max-xl:gap-0.5 max-xl:p-0 max-xl:text-left max-xl:before:text-xs max-xl:before:font-normal max-xl:before:text-muted-foreground";

const OPCIONES_FILTRO_STOCK: { filtro: FiltroStock; etiqueta: string }[] = [
  { filtro: "todos", etiqueta: "Todos" },
  { filtro: "faltantes", etiqueta: "Faltantes" },
  { filtro: "sin_stock", etiqueta: "Sin stock" },
  { filtro: "bajo_minimo", etiqueta: "Bajo mínimo" },
];

type ProductosTableProps = {
  productos: Producto[];
  categorias: Categoria[];
  // Dueño o encargado. La RLS es la barrera real; esto solo oculta lo que fallaría.
  puedeGestionar: boolean;
  // Solo el dueño crea categorías desde el formulario.
  puedeCrearCategoria: boolean;
  proveedores: ProveedorOpcion[];
};

export function ProductosTable({
  productos,
  categorias,
  puedeGestionar,
  puedeCrearCategoria,
  proveedores,
}: ProductosTableProps) {
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState<Producto | "nuevo" | null>(null);
  const [error, setError] = useState("");
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<Producto | null>(null);
  const router = useRouter();
  // El filtro vive en la URL: sigue puesto al volver de cargar stock.
  const filtroStock = parseFiltroStock(useSearchParams().get("stock"));

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return productos.filter(
      (producto) =>
        pasaFiltroStock(producto, filtroStock) &&
        (!term ||
          producto.nombre.toLowerCase().includes(term) ||
          producto.codigoBarras.includes(term)),
    );
  }, [productos, busqueda, filtroStock]);

  const cantidades = useMemo(
    () => contarPorFiltroStock(productos),
    [productos],
  );
  const conAlerta = cantidades.faltantes;

  // replaceState y no router.replace: filtrar no necesita volver a pedir el catálogo.
  function cambiarFiltroStock(filtro: FiltroStock) {
    const params = new URLSearchParams(window.location.search);
    if (filtro === "todos") params.delete("stock");
    else params.set("stock", filtro);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }

  function cerrarFormulario(aviso?: string) {
    setError(aviso ?? "");
    setFormulario(null);
    router.refresh();
  }

  async function handleDelete(producto: Producto) {
    if (!window.confirm(`¿Eliminar ${producto.nombre}?`)) return;

    setError("");
    setEliminando(producto.id);
    try {
      const result = await eliminarProducto(producto.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Si el producto borrado estaba abierto en el formulario, se cierra.
      setFormulario((actual) =>
        actual !== null && actual !== "nuevo" && actual.id === producto.id
          ? null
          : actual,
      );
      router.refresh();
    } catch {
      setError("No se pudo conectar. Revisá la conexión y probá de nuevo.");
    } finally {
      setEliminando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Buscar producto"
            placeholder="Buscá por nombre o código de barras..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="rounded-full pl-11"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {conAlerta > 0 && (
            <button
              type="button"
              aria-pressed={filtroStock === "faltantes"}
              title="Ver solo los productos con faltantes"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring xl:min-h-0"
              onClick={() =>
                cambiarFiltroStock(
                  filtroStock === "faltantes" ? "todos" : "faltantes",
                )
              }
            >
              <Badge variant="destructive" dot>
                {conAlerta === 1
                  ? "1 producto con stock bajo"
                  : `${conAlerta} productos con stock bajo`}
              </Badge>
            </button>
          )}
          {puedeGestionar && (
            <Button onClick={() => setFormulario("nuevo")}>
              Nuevo producto
            </Button>
          )}
        </div>
      </div>

      {(conAlerta > 0 || filtroStock !== "todos") && (
        <div
          role="group"
          aria-label="Filtrar por stock"
          className="flex flex-wrap gap-2"
        >
          {OPCIONES_FILTRO_STOCK.map(({ filtro, etiqueta }) => (
            <Button
              key={filtro}
              size="sm"
              variant={filtroStock === filtro ? "default" : "outline"}
              aria-pressed={filtroStock === filtro}
              className="max-xl:h-11"
              onClick={() =>
                cambiarFiltroStock(filtro === filtroStock ? "todos" : filtro)
              }
            >
              {filtro === "todos"
                ? etiqueta
                : `${etiqueta} (${cantidades[filtro]})`}
            </Button>
          ))}
        </div>
      )}

      {puedeGestionar && (
        <Dialog
          open={formulario !== null}
          onOpenChange={(abierto) => {
            if (!abierto) setFormulario(null);
          }}
        >
          <DialogContent className="gap-0 overflow-hidden p-0 pb-0 sm:max-h-[90dvh] sm:max-w-5xl sm:pb-0">
            {formulario && (
              <ProductoForm
                key={formulario === "nuevo" ? "nuevo" : formulario.id}
                categorias={categorias}
                producto={formulario === "nuevo" ? undefined : formulario}
                puedeCrearCategoria={puedeCrearCategoria}
                proveedores={proveedores}
                onSuccess={cerrarFormulario}
                onCancel={() => setFormulario(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {puedeGestionar && (
        <EtiquetasDialog
          producto={etiquetas}
          onClose={() => setEtiquetas(null)}
        />
      )}

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card max-xl:overflow-x-visible max-xl:rounded-none max-xl:border-0 max-xl:bg-transparent">
        <Table className="max-xl:block">
          <TableHeader className="max-xl:sr-only">
            <TableRow className="hover:bg-transparent">
              <TableHead>Producto</TableHead>
              <TableHead className="hidden xl:table-cell">Categoría</TableHead>
              {puedeGestionar && (
                <TableHead className="text-right">Costo</TableHead>
              )}
              <TableHead className="text-right">Precio</TableHead>
              {puedeGestionar && (
                <TableHead className="text-right">Margen</TableHead>
              )}
              <TableHead className="text-right">Stock</TableHead>
              {puedeGestionar && <TableHead>Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody className="max-xl:flex max-xl:flex-col max-xl:gap-3">
            {filtrados.map((producto) => {
              const margen = calcularMargen(producto.costo, producto.precio);

              return (
                <TableRow
                  key={producto.id}
                  className="max-xl:grid max-xl:grid-cols-2 max-xl:gap-x-3 max-xl:gap-y-3 max-xl:rounded-xl max-xl:border! max-xl:border-border max-xl:bg-card max-xl:p-3 max-xl:hover:bg-card"
                >
                  <TableCell className="whitespace-normal max-xl:order-1 max-xl:col-span-2 max-xl:p-0">
                    <div className="flex items-center gap-3">
                      <FotoProducto
                        src={producto.fotoUrl}
                        className="size-10"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold">{producto.nombre}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {producto.codigoBarras}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-normal text-muted-foreground xl:table-cell">
                    {producto.categoriaNombre ?? "—"}
                  </TableCell>
                  {puedeGestionar && (
                    <TableCell
                      className={`text-right tabular-nums max-xl:order-4 max-xl:before:content-['Costo'] ${DATO_TARJETA}`}
                    >
                      {producto.costo === null
                        ? "—"
                        : formatCurrency(producto.costo)}
                    </TableCell>
                  )}
                  <TableCell
                    className={`text-right font-semibold tabular-nums max-xl:order-2 max-xl:text-lg max-xl:before:content-['Precio'] ${DATO_TARJETA}`}
                  >
                    {formatCurrency(producto.precio)}
                  </TableCell>
                  {puedeGestionar && (
                    <TableCell
                      className={`text-right tabular-nums max-xl:order-5 max-xl:before:content-['Margen'] ${DATO_TARJETA}`}
                    >
                      {formatPercent(margen)}
                    </TableCell>
                  )}
                  <TableCell
                    className={`text-right max-xl:order-3 max-xl:whitespace-normal max-xl:before:content-['Stock'] ${DATO_TARJETA}`}
                  >
                    <StockCell producto={producto} />
                  </TableCell>
                  {puedeGestionar && (
                    <TableCell className="max-xl:order-6 max-xl:col-span-2 max-xl:p-0">
                      <div className="flex gap-2 max-xl:flex-wrap max-xl:[&_button]:h-11">
                        {filtroStock !== "todos" && (
                          <Link
                            href={`/stock?producto=${producto.id}&desde=${filtroStock}`}
                            className={buttonVariants({
                              size: "sm",
                              className:
                                "max-xl:h-11 max-xl:basis-full xl:size-8 xl:px-0",
                            })}
                            aria-label="Sumar stock"
                            title="Sumar stock"
                          >
                            <PackagePlus
                              aria-hidden="true"
                              className="max-xl:hidden"
                            />
                            <span className="xl:hidden">Sumar stock</span>
                          </Link>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="max-xl:flex-1"
                          onClick={() => setFormulario(producto)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="Etiquetas"
                          title="Etiquetas"
                          className="xl:size-8 xl:px-0"
                          onClick={() => setEtiquetas(producto)}
                        >
                          <Tag aria-hidden="true" className="max-xl:hidden" />
                          <span className="xl:hidden">Etiquetas</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label={
                            eliminando === producto.id
                              ? "Eliminando..."
                              : "Eliminar"
                          }
                          title="Eliminar"
                          className="xl:size-8 xl:px-0"
                          disabled={eliminando !== null}
                          onClick={() => void handleDelete(producto)}
                        >
                          <Trash2
                            aria-hidden="true"
                            className="max-xl:hidden"
                          />
                          <span className="xl:hidden">
                            {eliminando === producto.id
                              ? "Eliminando..."
                              : "Eliminar"}
                          </span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {filtrados.length === 0 && (
              <TableRow className="max-xl:block max-xl:border-0">
                <TableCell
                  colSpan={puedeGestionar ? 7 : 4}
                  className="py-10 text-center whitespace-normal text-muted-foreground max-xl:block"
                >
                  {filtroStock !== "todos" && !busqueda.trim()
                    ? "No hay productos con este filtro."
                    : "No se encontraron productos."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
