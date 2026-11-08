import { requireRol } from "@/modules/auth";
import { getProveedores } from "@/modules/proveedores";
import { ProveedoresScreen } from "@/modules/proveedores/components/proveedores-screen";

export const dynamic = "force-dynamic";

export default async function ProveedoresPage() {
  await requireRol("/stock/proveedores");
  const proveedores = await getProveedores();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          A quién le comprás. Un proveedor no se borra: se desactiva.
        </p>
      </div>
      {proveedores.ok ? (
        <ProveedoresScreen proveedores={proveedores.data} />
      ) : (
        <p className="text-sm text-destructive">{proveedores.error}</p>
      )}
    </main>
  );
}
