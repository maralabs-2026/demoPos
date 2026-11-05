import { Button } from "@/components/ui/button";
import { requireRol } from "@/modules/auth";
import { getCategorias } from "@/modules/productos";
import { getProductosAContar } from "@/modules/stock";
import { AuditoriaForm } from "@/modules/stock/components/auditoria-form";

export const dynamic = "force-dynamic";

const SIN_CATEGORIA = "sin";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  await requireRol("/stock/auditoria");

  const { categoria } = await searchParams;
  const categorias = await getCategorias();
  // Solo una categoría del comercio: lo demás vuelve a pedir que elijas.
  const elegida =
    categoria === SIN_CATEGORIA ||
    (categorias.ok && categorias.data.some((c) => c.id === categoria))
      ? categoria
      : undefined;
  const categoriaId = elegida === SIN_CATEGORIA ? null : (elegida ?? null);
  const productos = elegida ? await getProductosAContar(categoriaId) : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-3xl">Auditoría de stock</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="categoria" className="text-sm font-semibold">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={elegida ?? ""}
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="" disabled>
              Elegí qué vas a contar
            </option>
            {categorias.ok &&
              categorias.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            <option value={SIN_CATEGORIA}>Sin categoría</option>
          </select>
        </div>
        <Button type="submit" variant="outline">
          Empezá a contar
        </Button>
      </form>

      {!categorias.ok && (
        <p className="text-sm text-destructive">{categorias.error}</p>
      )}
      {productos && !productos.ok && (
        <p className="text-sm text-destructive">{productos.error}</p>
      )}
      {productos?.ok && productos.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Esta categoría no tiene productos.
        </p>
      )}
      {productos?.ok && productos.data.length > 0 && (
        // key: al cambiar de categoría, el conteo arranca de cero.
        <AuditoriaForm
          key={elegida}
          categoriaId={categoriaId}
          productos={productos.data}
        />
      )}
    </main>
  );
}
