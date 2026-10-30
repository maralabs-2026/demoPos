import { requireRol } from "@/modules/auth";
import { getCategorias, getProductos } from "@/modules/productos";
import { getPromociones } from "@/modules/promociones/queries";
import { PromocionesScreen } from "@/modules/promociones/components/promociones-screen";

export const dynamic = "force-dynamic";

export default async function PromocionesPage() {
  await requireRol("/promociones");

  const [promosResult, productosResult, categoriasResult] = await Promise.all([
    getPromociones(),
    getProductos(),
    getCategorias(),
  ]);
  const error = !promosResult.ok
    ? promosResult.error
    : !productosResult.ok
      ? productosResult.error
      : !categoriasResult.ok
        ? categoriasResult.error
        : null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl">Promos y combos</h1>
        <p className="text-sm text-muted-foreground">
          Se aplican solas en el ticket cuando están vigentes. Pausá una para
          sacarla sin borrarla.
        </p>
      </div>
      {error ||
      !promosResult.ok ||
      !productosResult.ok ||
      !categoriasResult.ok ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <PromocionesScreen
          promos={promosResult.data}
          productos={productosResult.data}
          categorias={categoriasResult.data}
        />
      )}
    </main>
  );
}
