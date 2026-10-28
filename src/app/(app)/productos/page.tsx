import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { canAccess, getAuthProfile } from "@/modules/auth";
import { getProductos } from "@/modules/productos";
import { ProductosTable } from "@/modules/productos/components/productos-table";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const [result, profile] = await Promise.all([
    getProductos(),
    getAuthProfile(),
  ]);
  const puedeEditarPrecios =
    profile !== null && canAccess(profile.rol, "/productos/precios");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Productos</h1>
          <p className="text-muted-foreground text-sm">
            Consulta de catálogo y stock.
          </p>
        </div>
        {puedeEditarPrecios && (
          <Link
            href="/productos/precios"
            className={buttonVariants({ variant: "outline" })}
          >
            Actualizar precios
          </Link>
        )}
      </div>

      {result.ok ? (
        <ProductosTable productos={result.data} />
      ) : (
        <p className="text-destructive text-sm">{result.error}</p>
      )}
    </main>
  );
}
