import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getAuthProfile } from "@/modules/auth";
import { getProductos } from "@/modules/productos";
import { ProductosTable } from "@/modules/productos/components/productos-table";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const [result, profile] = await Promise.all([getProductos(), getAuthProfile()]);
  const puedeEditarPrecios = profile?.rol === "dueno" || profile?.rol === "encargado";

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Productos</h1>
          <p className="text-muted-foreground text-sm">Consulta de catálogo y stock.</p>
        </div>
        {puedeEditarPrecios && (
          <Link href="/productos/precios" className={buttonVariants({ variant: "outline" })}>
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
