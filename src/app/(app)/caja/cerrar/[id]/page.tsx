import { notFound } from "next/navigation";
import { requireRol } from "@/modules/auth";
import {
  getCajaAbiertaPorId,
  getMediosAContar,
  getMovimientosCaja,
} from "@/modules/caja";
import { CerrarCajaForm } from "@/modules/caja/components/cerrar-caja-form";
import { MovimientosCaja } from "@/modules/caja/components/movimientos-caja";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dueño y encargado operan una caja que tiene otro: registran retiros e ingresos, o la cierran si
// quedó abierta.
export default async function CerrarCajaDeOtroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRol("/caja/cerrar");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const cajaResult = await getCajaAbiertaPorId(id);
  if (cajaResult.ok && !cajaResult.data) notFound();
  const [mediosResult, movimientosResult] = await Promise.all([
    getMediosAContar(id),
    getMovimientosCaja(id),
  ]);

  const error = !cajaResult.ok
    ? cajaResult.error
    : !mediosResult.ok
      ? mediosResult.error
      : !movimientosResult.ok
        ? movimientosResult.error
        : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Caja abierta</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {cajaResult.ok && cajaResult.data && movimientosResult.ok && (
        <MovimientosCaja
          cajaId={cajaResult.data.id}
          movimientos={movimientosResult.data}
        />
      )}
      {cajaResult.ok && cajaResult.data && mediosResult.ok && (
        <CerrarCajaForm
          cajaId={cajaResult.data.id}
          abiertaAt={cajaResult.data.abiertaAt}
          titular={cajaResult.data.titular}
          medios={mediosResult.data}
        />
      )}
    </main>
  );
}
