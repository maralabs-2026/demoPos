import { getMediosPago } from "@/modules/config";
import { getProductos } from "@/modules/productos";
import { VentaScreen } from "@/modules/ventas/components/venta-screen";

export const dynamic = "force-dynamic";

export default async function VenderPage() {
  const [productosResult, mediosPagoResult] = await Promise.all([
    getProductos(),
    getMediosPago(),
  ]);

  if (!productosResult.ok) {
    return (
      <main className="p-6">
        <p className="text-destructive text-sm">{productosResult.error}</p>
      </main>
    );
  }
  if (!mediosPagoResult.ok) {
    return (
      <main className="p-6">
        <p className="text-destructive text-sm">{mediosPagoResult.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <VentaScreen
        productosIniciales={productosResult.data}
        mediosPago={mediosPagoResult.data}
      />
    </main>
  );
}
