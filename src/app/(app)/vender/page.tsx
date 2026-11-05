import { getAuthProfile } from "@/modules/auth";
import { getCajaAbierta } from "@/modules/caja";
import { AbrirCaja } from "@/modules/caja/components/abrir-caja";
import {
  getDescuentoMaxCajeroPct,
  getMediosPago,
  getTicketConfig,
} from "@/modules/config";
import { getCombos, getPromociones } from "@/modules/promociones/queries";
import { getProductos } from "@/modules/productos";
import { VentaScreen } from "@/modules/ventas/components/venta-screen";

export const dynamic = "force-dynamic";

export default async function VenderPage() {
  const [
    profile,
    cajaResult,
    productosResult,
    mediosPagoResult,
    topeResult,
    promosResult,
    combosResult,
    ticketResult,
  ] = await Promise.all([
    getAuthProfile(),
    getCajaAbierta(),
    getProductos(),
    getMediosPago(),
    getDescuentoMaxCajeroPct(),
    getPromociones(),
    getCombos(),
    getTicketConfig(),
  ]);
  // Dueño y encargado sin tope; el cajero, hasta lo que diga la configuración.
  const descuentoMaxPct =
    profile?.rol === "cajero" ? (topeResult.ok ? topeResult.data : 10) : 100;

  const error = !cajaResult.ok
    ? cajaResult.error
    : !productosResult.ok
      ? productosResult.error
      : !mediosPagoResult.ok
        ? mediosPagoResult.error
        : !promosResult.ok
          ? promosResult.error
          : !combosResult.ok
            ? combosResult.error
            : null;
  if (
    error ||
    !cajaResult.ok ||
    !productosResult.ok ||
    !mediosPagoResult.ok ||
    !promosResult.ok ||
    !combosResult.ok
  ) {
    return (
      <main className="p-6">
        <p className="text-destructive text-sm">{error}</p>
      </main>
    );
  }

  // Sin caja abierta no se puede cobrar (registrar_venta la exige).
  if (!cajaResult.data) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <AbrirCaja />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <VentaScreen
        cajaId={cajaResult.data.id}
        descuentoMaxPct={descuentoMaxPct}
        productosIniciales={productosResult.data}
        mediosPago={mediosPagoResult.data}
        promos={promosResult.data}
        combos={combosResult.data}
        horaServidorMs={Date.now()}
        ticketTextos={
          // Sin los textos, el ticket igual se imprime con los datos de la venta: no frena el cobro.
          ticketResult.ok
            ? ticketResult.data
            : { titulo: "", leyenda: "", pie: "" }
        }
      />
    </main>
  );
}
