import { requireRol } from "@/modules/auth";
import { getMediosPagoConfig } from "@/modules/config";
import { MediosPagoScreen } from "@/modules/config/components/medios-pago-screen";
import { getPuntosQr, isMercadoPagoConfigured } from "@/modules/pagos-mp";
import { PuntosQrScreen } from "@/modules/pagos-mp/components/puntos-qr-screen";

export const dynamic = "force-dynamic";

export default async function MediosPagoPage() {
  await requireRol("/config");
  const [medios, puntos] = await Promise.all([
    getMediosPagoConfig(),
    getPuntosQr(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Medios de pago</h1>
      {!medios.ok && <p className="text-sm text-destructive">{medios.error}</p>}
      {medios.ok && <MediosPagoScreen medios={medios.data} />}
      {!puntos.ok && <p className="text-sm text-destructive">{puntos.error}</p>}
      {puntos.ok && (
        <PuntosQrScreen
          puntos={puntos.data}
          conectado={isMercadoPagoConfigured()}
        />
      )}
    </main>
  );
}
