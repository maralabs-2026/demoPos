import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getAuthProfile } from "@/modules/auth";
import { getCategorias, getProductos } from "@/modules/productos";
import { ProductosTable } from "@/modules/productos/components/productos-table";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const profile = await getAuthProfile();
  const puedeGestionar = profile?.rol === "dueno" || profile?.rol === "encargado";
  const [productosResult, categoriasResult] = await Promise.all([
    getProductos(undefined, puedeGestionar),
    getCategorias(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Productos</h1>
          <p className="text-muted-foreground text-sm">
            {puedeGestionar ? "Gestión de catálogo y stock." : "Consulta de catálogo y stock."}
          </p>
        </div>
        {puedeGestionar && (
          <Link href="/productos/precios" className={buttonVariants({ variant: "outline" })}>
            Actualizar precios
          </Link>
        )}
      </div>

      {!productosResult.ok ? (
        <p className="text-destructive text-sm">{productosResult.error}</p>
      ) : !categoriasResult.ok ? (
        <p className="text-destructive text-sm">{categoriasResult.error}</p>
      ) : (
        <ProductosTable
          productos={productosResult.data}
          categorias={categoriasResult.data}
          puedeGestionar={puedeGestionar}
        />
      )}
    </main>
  );
}
