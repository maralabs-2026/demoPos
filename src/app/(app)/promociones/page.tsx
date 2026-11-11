import { requireRol } from "@/modules/auth";
import { getCategorias, getProductos } from "@/modules/productos";
import { CombosSection } from "@/modules/promociones/components/combos-section";
import { PromocionesScreen } from "@/modules/promociones/components/promociones-screen";
import { getCombos, getPromociones } from "@/modules/promociones/queries";

export const dynamic = "force-dynamic";

export default async function PromocionesPage() {
  await requireRol("/promociones");

  const [promosResult, combosResult, productosResult, categoriasResult] =
    await Promise.all([
      getPromociones(),
      getCombos(),
      // Con los desactivados, para mostrar el nombre en las promos y combos que ya los tienen.
      getProductos(undefined, false, true),
      getCategorias(),
    ]);
  const error = !promosResult.ok
    ? promosResult.error
    : !combosResult.ok
      ? combosResult.error
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
      !combosResult.ok ||
      !productosResult.ok ||
      !categoriasResult.ok ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <PromocionesScreen
            promos={promosResult.data}
            productos={productosResult.data}
            categorias={categoriasResult.data}
          />
          <CombosSection
            combos={combosResult.data}
            productos={productosResult.data}
          />
        </>
      )}
    </main>
  );
}
