import { getCategorias, getProductos } from "@/modules/productos";
import { ProductosTable } from "@/modules/productos/components/productos-table";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const [productosResult, categoriasResult] = await Promise.all([
    getProductos(),
    getCategorias(),
  ]);

  if (!productosResult.ok) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Productos</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de catálogo y stock.
          </p>
        </div>

        <p className="text-destructive text-sm">
          {productosResult.error}
        </p>
      </main>
    );
  }

  if (!categoriasResult.ok) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Productos</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de catálogo y stock.
          </p>
        </div>

        <p className="text-destructive text-sm">
          {categoriasResult.error}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Productos</h1>
        <p className="text-muted-foreground text-sm">
          Gestión de catálogo y stock.
        </p>
      </div>

      <ProductosTable
        productos={productosResult.data}
        categorias={categoriasResult.data}
      />
    </main>
  );
}
