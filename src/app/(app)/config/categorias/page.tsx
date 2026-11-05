import { requireRol } from "@/modules/auth";
import { getCategorias } from "@/modules/productos";
import { CategoriasScreen } from "@/modules/config/components/categorias-screen";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  await requireRol("/config");
  const categorias = await getCategorias();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Categorías</h1>
      {!categorias.ok && (
        <p className="text-sm text-destructive">{categorias.error}</p>
      )}
      {categorias.ok && <CategoriasScreen categorias={categorias.data} />}
    </main>
  );
}
