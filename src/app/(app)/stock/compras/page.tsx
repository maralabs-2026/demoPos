import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { requireRol } from "@/modules/auth";
import { getCajasParaPagar } from "@/modules/caja";
import { getProductos } from "@/modules/productos";
import { getCompras, getProveedores } from "@/modules/proveedores";
import { CompraForm } from "@/modules/proveedores/components/compra-form";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  await requireRol("/stock/compras");
  const [proveedores, productos, cajas, compras] = await Promise.all([
    getProveedores(),
    getProductos(undefined, true),
    getCajasParaPagar(),
    getCompras(),
  ]);
  const error = !proveedores.ok
    ? proveedores.error
    : !productos.ok
      ? productos.error
      : !cajas.ok
        ? cajas.error
        : !compras.ok
          ? compras.error
          : null;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Compras</h1>
        <p className="text-sm text-muted-foreground">
          Al registrarla suma el stock, actualiza el costo y carga el gasto. El
          precio de venta no cambia.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {proveedores.ok && proveedores.data.every((p) => !p.activo) && (
        <p className="text-sm text-muted-foreground">
          Primero cargá un proveedor en{" "}
          <Link href="/stock/proveedores" className="font-semibold underline">
            Proveedores
          </Link>
          .
        </p>
      )}

      {proveedores.ok && productos.ok && cajas.ok && (
        <CompraForm
          proveedores={proveedores.data.filter((p) => p.activo)}
          // Un servicio no lleva stock: no se compra.
          productos={productos.data
            .filter((p) => p.controlaStock)
            .map((p) => ({
              id: p.id,
              nombre: p.nombre,
              codigoBarras: p.codigoBarras,
              costo: p.costo,
            }))}
          cajas={cajas.data}
        />
      )}

      {compras.ok && compras.data.length > 0 && (
        <Card className="gap-1 p-5">
          <h2 className="font-display text-lg font-bold">Últimas compras</h2>
          <ul aria-label="Últimas compras" className="flex flex-col">
            {compras.data.map((c) => (
              <li
                key={c.id}
                className="border-b border-border py-2.5 text-sm last:border-0"
              >
                <details>
                  <summary className="flex cursor-pointer items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-semibold break-words">
                        {c.proveedor}
                        {c.comprobante ? ` · ${c.comprobante}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(c.fecha)}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(c.total)}
                    </span>
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                    {c.items.map((i, n) => (
                      <li key={n} className="flex justify-between gap-3">
                        <span className="min-w-0 break-words">
                          {i.cantidad} × {i.nombre} a{" "}
                          {formatCurrency(i.costoUnitario)}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(i.subtotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
