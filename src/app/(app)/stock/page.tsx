import { requireRol } from "@/modules/auth";
import { getProductos } from "@/modules/productos";
import { getMovimientos } from "@/modules/stock";
import { HistorialMovimientos } from "@/modules/stock/components/historial-movimientos";
import { StockScreen } from "@/modules/stock/components/stock-screen";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>;
}) {
  await requireRol("/stock");

  const { producto } = await searchParams;
  const [productosResult, movimientosResult] = await Promise.all([
    getProductos(),
    producto ? getMovimientos(producto) : null,
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Stock</h1>
        <p className="text-muted-foreground text-sm">
          Cargá ingresos de mercadería y ajustes con motivo.
        </p>
      </div>

      {productosResult.ok ? (
        <StockScreen
          productos={productosResult.data}
          productoSeleccionadoId={producto ?? null}
          historial={
            movimientosResult === null ? null : movimientosResult.ok ? (
              <HistorialMovimientos movimientos={movimientosResult.data} />
            ) : (
              <p className="text-destructive text-sm">
                {movimientosResult.error}
              </p>
            )
          }
        />
      ) : (
        <p className="text-destructive text-sm">{productosResult.error}</p>
      )}
    </main>
  );
}
