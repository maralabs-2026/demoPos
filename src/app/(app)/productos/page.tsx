import { getProveedores } from "@/modules/proveedores";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { canAccess, getAuthProfile } from "@/modules/auth";
import { getCategorias, getProductos } from "@/modules/productos";
import { ProductosTable } from "@/modules/productos/components/productos-table";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  // Todo en paralelo: la RLS de productos_costos ya le oculta los costos al cajero, así que se
  // pueden pedir sin esperar el perfil.
  const [profile, productosResult, categoriasResult, proveedores] =
    await Promise.all([
      getAuthProfile(),
      getProductos(undefined, true),
      getCategorias(),
      getProveedores(),
    ]);
  const puedeGestionar =
    profile !== null && canAccess(profile.rol, "/productos/precios");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Productos</h1>
          <p className="text-muted-foreground text-sm">
            {puedeGestionar
              ? "Gestión de catálogo y stock."
              : "Consulta de catálogo y stock."}
          </p>
        </div>
        {puedeGestionar && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/productos/importar"
              className={buttonVariants({ variant: "outline" })}
            >
              Importar CSV
            </Link>
            <Link
              href="/productos/precios"
              className={buttonVariants({ variant: "outline" })}
            >
              Actualizar precios
            </Link>
            <Link
              href="/promociones"
              className={buttonVariants({ variant: "outline" })}
            >
              Promos y combos
            </Link>
          </div>
        )}
      </div>

      {!productosResult.ok ? (
        <p className="text-destructive text-sm">{productosResult.error}</p>
      ) : !categoriasResult.ok ? (
        <p className="text-destructive text-sm">{categoriasResult.error}</p>
      ) : (
        <ProductosTable
          puedeCrearCategoria={profile?.rol === "dueno"}
          productos={productosResult.data}
          categorias={categoriasResult.data}
          proveedores={proveedores.ok ? proveedores.data : []}
          puedeGestionar={puedeGestionar}
        />
      )}
    </main>
  );
}
