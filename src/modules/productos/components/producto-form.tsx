"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImageUp, Plus, Trash2 } from "lucide-react";
import {
  crearCategoriaRapida,
  crearProducto,
  editarProducto,
  generarCodigoInterno,
  guardarFotoProducto,
  quitarFotoProducto,
} from "../actions";
import { achicarFoto } from "../foto";
import type { Categoria, Producto } from "../queries";
import {
  calcularMargen,
  FOTO_TIPO,
  precioDesdeMargen,
  STOCK_INICIAL_MAX,
} from "../schemas";
import { CamaraCodigo } from "@/components/camara-codigo";
import { FotoProducto } from "@/components/foto-producto";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency, parseMonto } from "@/lib/currency";

// Muestra un monto guardado como lo escribiría el usuario: "1234,5".
function montoAEditar(value: number | null | undefined): string {
  return value === null || value === undefined
    ? ""
    : value.toLocaleString("es-AR", {
        useGrouping: false,
        maximumFractionDigits: 2,
      });
}

const SUMAS_STOCK = [1, 5, 10, 24] as const;

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

function Campo({
  id,
  label,
  ayuda,
  children,
}: {
  id: string;
  label: React.ReactNode;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

type ProductoFormProps = {
  categorias: Categoria[];
  producto?: Producto;
  // Crear categorías es del dueño: el encargado no ve "+ Nueva".
  puedeCrearCategoria: boolean;
  // `aviso`: el producto se guardó, pero algo posterior (foto o stock inicial) falló.
  onSuccess?: (aviso?: string) => void;
  onCancel?: () => void;
};

export function ProductoForm({
  categorias: categoriasIniciales,
  producto,
  puedeCrearCategoria,
  onSuccess,
  onCancel,
}: ProductoFormProps) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [codigoBarras, setCodigoBarras] = useState(
    producto?.codigoBarras ?? "",
  );
  const [categorias, setCategorias] = useState(categoriasIniciales);
  const [categoriaId, setCategoriaId] = useState(producto?.categoriaId ?? "");
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [costo, setCosto] = useState(montoAEditar(producto?.costo));
  const [precio, setPrecio] = useState(montoAEditar(producto?.precio));
  const [margenTexto, setMargenTexto] = useState(() => {
    const m = producto ? calcularMargen(producto.costo, producto.precio) : null;
    return m === null ? "" : montoAEditar(Math.round(m * 100) / 100);
  });
  const [unidadVenta, setUnidadVenta] = useState(
    producto?.unidadVenta ?? "unidad",
  );
  const [stockInicial, setStockInicial] = useState("0");
  const [stockMinimo, setStockMinimo] = useState(
    producto?.stockMinimo !== undefined ? String(producto.stockMinimo) : "0",
  );
  const [error, setError] = useState("");
  const [generandoCodigo, setGenerandoCodigo] = useState(false);

  async function handleGenerarCodigo() {
    setGenerandoCodigo(true);
    setError("");
    const result = await generarCodigoInterno();
    setGenerandoCodigo(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCodigoBarras(result.data);
  }
  const [guardando, setGuardando] = useState(false);
  const [fotoNueva, setFotoNueva] = useState<Blob | null>(null);
  const [fotoVistaPrevia, setFotoVistaPrevia] = useState<string | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const camaraInputRef = useRef<HTMLInputElement>(null);
  // "Sacá una foto" solo en pantallas táctiles (celular, tablet): en la PC abriría el mismo
  // selector de archivos que "Subí una imagen".
  const [tactil, setTactil] = useState(false);

  useEffect(() => {
    setTactil(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const formRef = useRef<HTMLFormElement>(null);
  const fotoVisible =
    fotoVistaPrevia ?? (quitarFoto ? null : (producto?.fotoUrl ?? null));

  useEffect(() => {
    if (!fotoVistaPrevia) return;
    return () => URL.revokeObjectURL(fotoVistaPrevia);
  }, [fotoVistaPrevia]);

  // Costo vacío = costo desconocido. Un texto que no se entiende (NaN) nunca se guarda como vacío.
  const costoNumero = parseMonto(costo);
  const precioNumero = parseMonto(precio);
  const costoInvalido = Number.isNaN(costoNumero);
  const precioInvalido = precioNumero === null || Number.isNaN(precioNumero);
  const ganancia =
    precioInvalido || costoInvalido || costoNumero === null
      ? null
      : precioNumero - costoNumero;

  // El margen se recalcula cuando cambian el costo o el precio; si se edita el margen, se
  // recalcula el precio. Es el margen sobre el precio, el mismo que muestra la tabla.
  function margenDe(costoTexto: string, precioTexto: string): string {
    const c = parseMonto(costoTexto);
    const p = parseMonto(precioTexto);
    if (c === null || Number.isNaN(c) || p === null || Number.isNaN(p)) {
      return "";
    }
    const m = calcularMargen(c, p);
    return m === null ? "" : montoAEditar(Math.round(m * 100) / 100);
  }

  function handleCosto(valor: string) {
    setCosto(valor);
    setMargenTexto(margenDe(valor, precio));
  }

  function handlePrecio(valor: string) {
    setPrecio(valor);
    setMargenTexto(margenDe(costo, valor));
  }

  function handleMargen(valor: string) {
    setMargenTexto(valor);
    const m = parseMonto(valor);
    const nuevo = precioDesdeMargen(
      costoInvalido ? null : costoNumero,
      m === null || Number.isNaN(m) ? null : m,
    );
    if (nuevo !== null) setPrecio(montoAEditar(nuevo));
  }

  function sumarStock(cantidad: number) {
    const actual = Number.parseInt(stockInicial, 10);
    const base = Number.isFinite(actual) && actual > 0 ? actual : 0;
    setStockInicial(String(Math.min(base + cantidad, STOCK_INICIAL_MAX)));
  }

  async function handleFoto(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;
    setError("");
    setProcesandoFoto(true);
    try {
      const blob = await achicarFoto(archivo);
      setFotoNueva(blob);
      setFotoVistaPrevia(URL.createObjectURL(blob));
      setQuitarFoto(false);
    } catch {
      setError("No se pudo leer esa imagen. Probá con un JPG o un PNG.");
    } finally {
      setProcesandoFoto(false);
    }
  }

  function handleQuitarFoto() {
    setFotoNueva(null);
    setFotoVistaPrevia(null);
    setQuitarFoto(true);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
    if (camaraInputRef.current) camaraInputRef.current.value = "";
  }

  async function handleCrearCategoria() {
    if (nuevaCategoria === null || creandoCategoria) return;
    setError("");
    setCreandoCategoria(true);
    try {
      const result = await crearCategoriaRapida(nuevaCategoria);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCategorias((actuales) => [...actuales, result.data]);
      setCategoriaId(result.data.id);
      setNuevaCategoria(null);
    } catch {
      setError("No se pudo conectar. Revisá la conexión y probá de nuevo.");
    } finally {
      setCreandoCategoria(false);
    }
  }

  // Corre con el producto ya guardado: si falla, no se puede reintentar con el mismo formulario
  // (crearía el producto otra vez), así que devuelve un aviso en vez de dejarlo abierto.
  async function guardarCambiosFoto(id: string): Promise<string | undefined> {
    const aviso =
      "El producto se guardó, pero la foto no. Editalo y probá de nuevo.";
    try {
      if (fotoNueva) {
        const formData = new FormData();
        formData.set("productoId", id);
        formData.set(
          "foto",
          new File([fotoNueva], "foto.jpg", { type: FOTO_TIPO }),
        );
        const result = await guardarFotoProducto(formData);
        return result.ok ? undefined : aviso;
      }
      if (quitarFoto) {
        const result = await quitarFotoProducto(id);
        return result.ok ? undefined : aviso;
      }
      return undefined;
    } catch {
      return aviso;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando || procesandoFoto) return;
    setError("");
    if (precioInvalido) {
      setError("Revisá el precio de venta: escribilo como 1234,50.");
      return;
    }
    if (costoInvalido) {
      setError(
        "Revisá el costo: escribilo como 1234,50, o dejalo vacío si no lo sabés.",
      );
      return;
    }
    const cantidadInicial = Number(stockInicial === "" ? "0" : stockInicial);

    const input = {
      nombre,
      codigoBarras,
      categoriaId: categoriaId === "" ? null : categoriaId,
      costo: costoNumero,
      precio: precioNumero,
      unidadVenta,
      stockMinimo: Number(stockMinimo),
    };

    setGuardando(true);
    try {
      const result = producto
        ? await editarProducto(producto.id, input, {
            precio: producto.precio,
            costo: producto.costo,
          })
        : await crearProducto(input, cantidadInicial);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      const avisoFoto = await guardarCambiosFoto(result.data.id);
      onSuccess?.(
        [result.data.aviso, avisoFoto].filter(Boolean).join(" ") || undefined,
      );
    } catch {
      setError("No se pudo conectar. Revisá la conexión y probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  // Ctrl+Enter (o Cmd+Enter) guarda desde cualquier campo.
  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      noValidate
      className="flex max-h-[inherit] min-h-0 flex-col"
    >
      <div className="border-b border-border px-6 py-5 pr-14">
        <DialogTitle>
          {producto ? "Editar producto" : "Agregar producto"}
        </DialogTitle>
        <DialogDescription className="mt-1">
          Los campos con * son obligatorios.
        </DialogDescription>
      </div>

      <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto px-6 py-5 lg:grid-cols-3">
        <Seccion titulo="Datos básicos">
          <Campo id="producto-nombre" label="Nombre del producto *">
            <Input
              id="producto-nombre"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej. Coca-Cola Zero 2,25 L"
              autoComplete="off"
              required
            />
          </Campo>

          <Campo id="producto-codigo" label="Código de barras *">
            <div className="relative">
              <Input
                id="producto-codigo"
                value={codigoBarras}
                onChange={(event) => setCodigoBarras(event.target.value)}
                placeholder="Escaneá o escribí"
                autoComplete="off"
                inputMode="numeric"
                className="pr-12"
                required
              />
              <CamaraCodigo
                onCodigo={setCodigoBarras}
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
              />
            </div>
            {codigoBarras.trim() === "" && (
              <button
                type="button"
                onClick={handleGenerarCodigo}
                disabled={generandoCodigo}
                className="self-start text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60"
              >
                {generandoCodigo
                  ? "Generando..."
                  : "¿No tiene código? Generá uno"}
              </button>
            )}
          </Campo>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Imagen</span>
            <div className="flex items-center gap-3">
              <FotoProducto src={fotoVisible} className="size-20" />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                <input
                  id="producto-foto"
                  ref={fotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Archivo de la imagen"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => void handleFoto(event)}
                />
                {/* capture abre directo la cámara trasera del celular. La foto pasa por
                    achicarFoto como cualquier otra imagen. */}
                <input
                  id="producto-foto-camara"
                  ref={camaraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Foto de la cámara"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => void handleFoto(event)}
                />
                {tactil && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={procesandoFoto}
                    onClick={() => camaraInputRef.current?.click()}
                  >
                    <Camera aria-hidden="true" />
                    Sacá una foto
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={procesandoFoto}
                  onClick={() => fotoInputRef.current?.click()}
                >
                  <ImageUp aria-hidden="true" />
                  {procesandoFoto
                    ? "Preparando..."
                    : fotoVisible
                      ? "Cambiá la imagen"
                      : "Subí una imagen"}
                </Button>
                {fotoVisible && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleQuitarFoto}
                  >
                    <Trash2 aria-hidden="true" />
                    Quitá la imagen
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="producto-categoria"
                className="text-sm font-medium"
              >
                Categoría
              </label>
              {puedeCrearCategoria && nuevaCategoria === null && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto px-0"
                  onClick={() => setNuevaCategoria("")}
                >
                  <Plus aria-hidden="true" />
                  Nueva
                </Button>
              )}
            </div>
            <select
              id="producto-categoria"
              value={categoriaId}
              onChange={(event) => setCategoriaId(event.target.value)}
              className={selectClass}
            >
              <option value="">Sin categoría</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
            {nuevaCategoria !== null && (
              <div className="flex gap-2">
                <Input
                  aria-label="Nombre de la categoría nueva"
                  value={nuevaCategoria}
                  maxLength={60}
                  placeholder="Ej. Bazar"
                  autoFocus
                  onChange={(event) => setNuevaCategoria(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.ctrlKey) {
                      event.preventDefault();
                      void handleCrearCategoria();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-10"
                  disabled={creandoCategoria}
                  onClick={() => void handleCrearCategoria()}
                >
                  {creandoCategoria ? "Creando..." : "Creá"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-10"
                  onClick={() => setNuevaCategoria(null)}
                >
                  Cancelá
                </Button>
              </div>
            )}
          </div>
        </Seccion>

        <Seccion titulo="Precios y rentabilidad">
          <div className="grid grid-cols-2 gap-3">
            <Campo id="producto-costo" label="Precio de costo">
              <Input
                id="producto-costo"
                inputMode="decimal"
                placeholder="$ 0"
                aria-invalid={costoInvalido || undefined}
                value={costo}
                onChange={(event) => handleCosto(event.target.value)}
              />
            </Campo>
            <Campo id="producto-margen" label="Margen %">
              <Input
                id="producto-margen"
                inputMode="decimal"
                placeholder="0"
                value={margenTexto}
                onChange={(event) => handleMargen(event.target.value)}
              />
            </Campo>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Margen sobre el precio de venta. Si lo cambiás, se recalcula el
            precio.
          </p>

          <div className="flex flex-col gap-3 rounded-2xl border border-success/30 bg-success-soft p-4">
            <div className="flex items-end justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label
                  htmlFor="producto-precio"
                  className="text-sm font-semibold"
                >
                  Precio de venta final *
                </label>
                <Input
                  id="producto-precio"
                  inputMode="decimal"
                  placeholder="$ 0"
                  aria-invalid={(precio !== "" && precioInvalido) || undefined}
                  value={precio}
                  onChange={(event) => handlePrecio(event.target.value)}
                  className="h-12 bg-card font-display text-2xl font-bold tabular-nums"
                  required
                />
              </div>
              <div className="shrink-0 pb-1 text-right" aria-live="polite">
                <p className="text-[0.625rem] font-bold tracking-widest text-success-text uppercase">
                  Ganancia
                </p>
                <p className="font-display text-xl font-extrabold text-success-text tabular-nums">
                  {ganancia === null
                    ? "—"
                    : `${ganancia >= 0 ? "+" : "−"}${formatCurrency(Math.abs(ganancia))}`}
                </p>
              </div>
            </div>
            {costoNumero === null && (
              <p className="text-xs text-muted-foreground">
                Cargá el costo para ver la ganancia y el margen.
              </p>
            )}
          </div>
        </Seccion>

        <Seccion titulo="Inventario">
          {producto ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border p-3">
              <span className="text-sm font-medium">Stock actual</span>
              <span className="font-display text-xl font-bold tabular-nums">
                {producto.stockActual} {producto.unidadVenta}
              </span>
              <Link
                href={`/stock?producto=${producto.id}`}
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Cargá un ingreso o ajustá en Stock
              </Link>
            </div>
          ) : (
            <Campo
              id="producto-stock-inicial"
              label="Cantidad en stock"
              ayuda="Se registra como ingreso de mercadería con motivo «Stock inicial»."
            >
              <Input
                id="producto-stock-inicial"
                type="number"
                min="0"
                max={STOCK_INICIAL_MAX}
                step="1"
                inputMode="numeric"
                value={stockInicial}
                onChange={(event) => setStockInicial(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {SUMAS_STOCK.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Sumá ${n} al stock`}
                    onClick={() => sumarStock(n)}
                  >
                    +{n}
                  </Button>
                ))}
              </div>
            </Campo>
          )}

          <Campo
            id="producto-stock-minimo"
            label="Stock mínimo"
            ayuda="Te avisamos cuando el stock llegue a este número."
          >
            <Input
              id="producto-stock-minimo"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={stockMinimo}
              onChange={(event) => setStockMinimo(event.target.value)}
              required
            />
          </Campo>

          <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
            <span className="text-sm font-semibold">Más opciones</span>
            <Campo
              id="producto-unidad"
              label="Presentación"
              ayuda="Unidad suelta, pack de 6, kilo… Se muestra junto al stock."
            >
              <Input
                id="producto-unidad"
                value={unidadVenta}
                onChange={(event) => setUnidadVenta(event.target.value)}
                placeholder="unidad"
                required
              />
            </Campo>
          </div>
        </Seccion>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-card px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end">
        {error && (
          <p
            className="text-sm font-medium text-destructive sm:mr-auto"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onCancel}
            >
              Cancelá
            </Button>
          )}
          <Button
            type="submit"
            size="lg"
            variant="success"
            disabled={guardando || procesandoFoto}
          >
            {guardando
              ? "Guardando..."
              : producto
                ? "Guardá los cambios"
                : "Creá el producto"}
            <kbd className="hidden h-5 items-center rounded-md border border-current/30 px-1.5 font-mono text-[11px] lg:inline-flex">
              Ctrl+Enter
            </kbd>
          </Button>
        </div>
      </div>
    </form>
  );
}
