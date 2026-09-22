import { getCategorias } from "@/modules/productos";
import { CsvImportPreview } from "@/modules/productos/components/csv-import-preview";
import { NuevoProductoForm } from "./nuevo-producto-form";

export const dynamic = "force-dynamic";

// TODO(fase-3): página de trabajo para la Fase 3 (semana 1). Todavía no está linkeada desde
// el nav ni protegida por rol: el formulario y la importación no escriben en la base porque
// las políticas RLS de productos exigen login (Fase 2, en curso). Se conecta y se protege por
// rol en la semana 2, junto con el resto del ABM (ingreso de mercadería, ajuste manual,
// actualización masiva).
export default async function NuevoProductoPage() {
  const categoriasResult = await getCategorias();

  if (!categoriasResult.ok) {
    return (
      <main className="p-6">
        <p className="text-destructive text-sm">{categoriasResult.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-10 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Nuevo producto</h1>
        <p className="text-muted-foreground text-sm">
          Vista previa de la Fase 3. Todavía no guarda en la base.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Alta manual</h2>
        <NuevoProductoForm categorias={categoriasResult.data} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Importar desde CSV</h2>
        <CsvImportPreview />
      </section>
    </main>
  );
}
