import { getProductos } from "@/modules/productos";
import { ProductosTable } from "@/modules/productos/components/productos-table";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const result = await getProductos();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl">Productos</h1>
        <p className="text-muted-foreground text-sm">
          Consulta de catálogo y stock. Solo lectura.
        </p>
      </div>

      {result.ok ? (
        <ProductosTable productos={result.data} />
      ) : (
        <p className="text-destructive text-sm">{result.error}</p>
      )}
    </main>
  );
}
