import { Card } from "@/components/ui/card";
import { requireRol } from "@/modules/auth";
import { getProductos } from "@/modules/productos";
import { getProveedores } from "@/modules/proveedores";
import {
  agruparPorProveedor,
  reposicionComoTexto,
  sugerirReposicion,
} from "@/modules/stock";
import { ReposicionAcciones } from "@/modules/stock/components/reposicion-acciones";

export const dynamic = "force-dynamic";

export default async function ReposicionPage() {
  const profile = await requireRol("/stock/reposicion");
  const [productos, proveedores] = await Promise.all([
    getProductos(),
    getProveedores(),
  ]);
  const lineas = productos.ok ? sugerirReposicion(productos.data) : [];
  const pedidos = agruparPorProveedor(
    lineas,
    proveedores.ok ? proveedores.data : [],
  );

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

      {pedidos.map((pedido) => (
        <section
          key={pedido.proveedorId ?? "sin-proveedor"}
          aria-label={`Pedido: ${pedido.nombre}`}
          className="flex flex-col gap-3"
        >
          <h2 className="font-display text-lg font-bold">{pedido.nombre}</h2>
          <ReposicionAcciones
            texto={reposicionComoTexto(pedido.lineas, profile.comercio)}
            telefono={pedido.telefono}
          />
          <Card className="gap-1 p-5">
            <ul
              aria-label={`Productos a reponer: ${pedido.nombre}`}
              className="flex flex-col"
            >
              {pedido.lineas.map((linea) => (
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
        </section>
      ))}
    </main>
  );
}
