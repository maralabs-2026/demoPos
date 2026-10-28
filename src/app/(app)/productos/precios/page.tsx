import { requireRol } from "@/modules/auth";
import { getCategorias, getProductos } from "@/modules/productos";
import { PreciosForm } from "@/modules/productos/components/precios-form";

export const dynamic = "force-dynamic";

export default async function PreciosPage() {
  await requireRol("/productos/precios");

  const [productosResult, categoriasResult] = await Promise.all([
    getProductos(),
    getCategorias(),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">
          Actualizar precios
        </h1>
        <p className="text-muted-foreground text-sm">
          Subí o bajá los precios de una categoría, o de todo el catálogo, con
          un porcentaje.
        </p>
      </div>

      {!productosResult.ok ? (
        <p className="text-destructive text-sm">{productosResult.error}</p>
      ) : !categoriasResult.ok ? (
        <p className="text-destructive text-sm">{categoriasResult.error}</p>
      ) : (
        <PreciosForm
          productos={productosResult.data}
          categorias={categoriasResult.data}
        />
      )}
    </main>
  );
}
