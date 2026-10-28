import { requireRol } from "@/modules/auth";
import { getCategorias, getProductos } from "@/modules/productos";
import { CsvImport } from "@/modules/productos/components/csv-import";

export const dynamic = "force-dynamic";

export default async function ImportarProductosPage() {
  await requireRol("/productos/importar");

  const [productosResult, categoriasResult] = await Promise.all([
    getProductos(),
    getCategorias(),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">
          Importar productos
        </h1>
        <p className="text-muted-foreground text-sm">
          Cargá o actualizá el catálogo desde una planilla. Los productos con un
          código que ya existe se actualizan; el stock no se toca.
        </p>
      </div>

      {!productosResult.ok ? (
        <p className="text-destructive text-sm">{productosResult.error}</p>
      ) : !categoriasResult.ok ? (
        <p className="text-destructive text-sm">{categoriasResult.error}</p>
      ) : (
        <CsvImport
          productos={productosResult.data}
          categorias={categoriasResult.data}
        />
      )}
    </main>
  );
}
