import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireRol } from "@/modules/auth";
import {
  getCajaAbierta,
  getCajasAbiertasDeOtros,
  getMediosAContar,
  getMovimientosCaja,
} from "@/modules/caja";
import { CerrarCajaForm } from "@/modules/caja/components/cerrar-caja-form";
import { MovimientosCaja } from "@/modules/caja/components/movimientos-caja";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const profile = await requireRol("/caja");

  const [cajaResult, otrasResult] = await Promise.all([
    getCajaAbierta(),
    getCajasAbiertasDeOtros(),
  ]);
  const [mediosResult, movimientosResult] =
    cajaResult.ok && cajaResult.data
      ? await Promise.all([
          getMediosAContar(cajaResult.data.id),
          getMovimientosCaja(cajaResult.data.id),
        ])
      : [null, null];

  const error = !cajaResult.ok
    ? cajaResult.error
    : !otrasResult.ok
      ? otrasResult.error
      : mediosResult && !mediosResult.ok
        ? mediosResult.error
        : movimientosResult && !movimientosResult.ok
          ? movimientosResult.error
          : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Caja</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {cajaResult.ok && cajaResult.data && movimientosResult?.ok && (
        <MovimientosCaja
          cajaId={cajaResult.data.id}
          movimientos={movimientosResult.data}
          puedeAjustar={profile.rol === "dueno"}
        />
      )}

      {cajaResult.ok && cajaResult.data && mediosResult?.ok && (
        <CerrarCajaForm
          cajaId={cajaResult.data.id}
          abiertaAt={cajaResult.data.abiertaAt}
          medios={mediosResult.data}
        />
      )}

      {cajaResult.ok && !cajaResult.data && (
        <Card className="max-w-lg gap-3 p-5">
          <p className="text-sm text-muted-foreground">
            No tenés una caja abierta. Abrila cuando vayas a vender.
          </p>
          <Button
            className="self-start"
            variant="success"
            nativeButton={false}
            render={<Link href="/vender" />}
          >
            Andá a vender
          </Button>
        </Card>
      )}

      {otrasResult.ok && otrasResult.data.length > 0 && (
        <section
          aria-label="Otras cajas abiertas"
          className="flex flex-col gap-2"
        >
          <h2 className="font-display text-lg font-bold">
            Otras cajas abiertas
          </h2>
          <ul className="flex flex-col gap-2">
            {otrasResult.data.map((caja) => (
              <li key={caja.id}>
                <Card className="flex-row items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {caja.titular}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Abierta el {formatDateTime(caja.abiertaAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/caja/cerrar/${caja.id}`} />}
                  >
                    Operá esta caja
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
