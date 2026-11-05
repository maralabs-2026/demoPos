import { Card } from "@/components/ui/card";
import { requireRol } from "@/modules/auth";
import { getProductos } from "@/modules/productos";
import { reposicionComoTexto, sugerirReposicion } from "@/modules/stock";
import { ReposicionAcciones } from "@/modules/stock/components/reposicion-acciones";

export const dynamic = "force-dynamic";

export default async function ReposicionPage() {
  const profile = await requireRol("/stock/reposicion");
  const productos = await getProductos();
  const lineas = productos.ok ? sugerirReposicion(productos.data) : [];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Reposición sugerida</h1>
        <p className="text-sm text-muted-foreground">
          Productos bajo el mínimo, con la cantidad para llegar al doble del
          mínimo.
        </p>
      </div>

      {!productos.ok && (
        <p className="text-sm text-destructive">{productos.error}</p>
      )}

      {productos.ok && lineas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay productos bajo el mínimo.
        </p>
      )}

      {lineas.length > 0 && (
        <>
          <ReposicionAcciones
            texto={reposicionComoTexto(lineas, profile.comercio)}
          />
          <Card className="gap-1 p-5">
            <ul aria-label="Productos a reponer" className="flex flex-col">
              {lineas.map((linea) => (
                <li
                  key={linea.id}
                  className="flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold break-words">
                      {linea.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Stock {linea.stockActual} · Mínimo {linea.stockMinimo}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    Pedí {linea.cantidad}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </main>
  );
}
