import { requireRol } from "@/modules/auth";
import { getProductos, parseFiltroStock } from "@/modules/productos";
import { getMovimientos } from "@/modules/stock";
import { HistorialMovimientos } from "@/modules/stock/components/historial-movimientos";
import { StockScreen } from "@/modules/stock/components/stock-screen";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string; desde?: string }>;
}) {
  await requireRol("/stock");

  const { producto, desde } = await searchParams;
  // Se llega desde el filtro de faltantes de /productos: se ofrece volver al mismo filtro.
  const filtroOrigen = parseFiltroStock(desde);
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
          // Un servicio (0031) no lleva stock: no se le cargan ingresos ni ajustes.
          productos={productosResult.data.filter((p) => p.controlaStock)}
          productoSeleccionadoId={producto ?? null}
          volverHref={
            filtroOrigen === "todos" ? null : `/productos?stock=${filtroOrigen}`
          }
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
