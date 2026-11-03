"use client";

import { useEffect, useRef, useState } from "react";
import {
  crearProducto,
  editarProducto,
  guardarFotoProducto,
  quitarFotoProducto,
} from "../actions";
import { achicarFoto } from "../foto";
import type { Categoria, Producto } from "../queries";
import { calcularMargen, FOTO_TIPO } from "../schemas";
import { FotoProducto } from "@/components/foto-producto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPercent, parseMonto } from "@/lib/currency";

// Muestra un monto guardado como lo escribiría el usuario: "1234,5".
function montoAEditar(value: number | null | undefined): string {
  return value === null || value === undefined
    ? ""
    : value.toLocaleString("es-AR", {
        useGrouping: false,
        maximumFractionDigits: 2,
      });
}

type ProductoFormProps = {
  categorias: Categoria[];
  producto?: Producto;
  // `aviso`: el producto se guardó, pero algo de la foto falló.
  onSuccess?: (aviso?: string) => void;
  onCancel?: () => void;
};

export function ProductoForm({
  categorias,
  producto,
  onSuccess,
  onCancel,
}: ProductoFormProps) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [codigoBarras, setCodigoBarras] = useState(
    producto?.codigoBarras ?? "",
  );
  const [categoriaId, setCategoriaId] = useState(producto?.categoriaId ?? "");
  const [costo, setCosto] = useState(montoAEditar(producto?.costo));
  const [precio, setPrecio] = useState(montoAEditar(producto?.precio));
  const [unidadVenta, setUnidadVenta] = useState(
    producto?.unidadVenta ?? "unidad",
  );
  const [stockMinimo, setStockMinimo] = useState(
    producto?.stockMinimo !== undefined ? String(producto.stockMinimo) : "0",
  );
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [fotoNueva, setFotoNueva] = useState<Blob | null>(null);
  const [fotoVistaPrevia, setFotoVistaPrevia] = useState<string | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
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
  const margen =
    precioInvalido || costoInvalido
      ? null
      : calcularMargen(costoNumero, precioNumero);

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
  }

  // Corre con el producto ya guardado: si falla, no se puede reintentar con el mismo formulario
  // (crearía el producto otra vez), así que devuelve un aviso en vez de dejarlo abierto.
  async function guardarCambiosFoto(id: string): Promise<string | undefined> {
    const aviso = "El producto se guardó, pero la foto no. Editalo y probá de nuevo.";
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
    setError("");
    if (precioInvalido) {
      setError("Revisá el precio: escribilo como 1234,50.");
      return;
    }
    if (costoInvalido) {
      setError(
        "Revisá el costo: escribilo como 1234,50, o dejalo vacío si no lo sabés.",
      );
      return;
    }

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
        : await crearProducto(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.(await guardarCambiosFoto(result.data.id));
    } catch {
      setError("No se pudo conectar. Revisá la conexión y probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      <div>
        <h2 className="text-lg font-medium">
          {producto ? "Editar producto" : "Nuevo producto"}
        </h2>
        <p className="text-muted-foreground text-sm">
          Completá los datos del producto.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-nombre" className="text-sm font-medium">
          Nombre
        </label>
        <Input
          id="producto-nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          placeholder="Ej. Coca Cola 500 ml"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-foto" className="text-sm font-medium">
          Foto (opcional)
        </label>
        <div className="flex items-center gap-3">
          <FotoProducto src={fotoVisible} className="size-16" />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <Input
              id="producto-foto"
              ref={fotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void handleFoto(event)}
            />
            {fotoVisible && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleQuitarFoto}
              >
                Quitar foto
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-codigo" className="text-sm font-medium">
          Código de barras
        </label>
        <Input
          id="producto-codigo"
          value={codigoBarras}
          onChange={(event) => setCodigoBarras(event.target.value)}
          placeholder="Ej. 7791234567890"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-categoria" className="text-sm font-medium">
          Categoría
        </label>
        <select
          id="producto-categoria"
          value={categoriaId}
          onChange={(event) => setCategoriaId(event.target.value)}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
        >
          <option value="">Sin categoría</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="producto-costo" className="text-sm font-medium">
            Costo (opcional)
          </label>
          <Input
            id="producto-costo"
            inputMode="decimal"
            placeholder="Ej. 850,50"
            aria-invalid={costoInvalido || undefined}
            value={costo}
            onChange={(event) => setCosto(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="producto-precio" className="text-sm font-medium">
            Precio
          </label>
          <Input
            id="producto-precio"
            inputMode="decimal"
            placeholder="Ej. 1200"
            aria-invalid={(precio !== "" && precioInvalido) || undefined}
            value={precio}
            onChange={(event) => setPrecio(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="producto-unidad" className="text-sm font-medium">
            Unidad de venta
          </label>
          <Input
            id="producto-unidad"
            value={unidadVenta}
            onChange={(event) => setUnidadVenta(event.target.value)}
            placeholder="unidad"
            required
          />
        </div>
      </div>

      <div className="text-sm" aria-live="polite">
        <span className="text-muted-foreground">
          Margen bruto sobre precio:{" "}
        </span>
        <span className="font-medium">{formatPercent(margen)}</span>
      </div>

      <div className="space-y-2">
        <label htmlFor="producto-stock-minimo" className="text-sm font-medium">
          Stock mínimo
        </label>
        <Input
          id="producto-stock-minimo"
          type="number"
          min="0"
          step="1"
          value={stockMinimo}
          onChange={(event) => setStockMinimo(event.target.value)}
          required
        />
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={guardando || procesandoFoto}>
          {guardando ? "Guardando..." : producto ? "Guardar cambios" : "Crear"}
        </Button>

        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
