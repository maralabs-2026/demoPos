import { requireRol } from "@/modules/auth";
import { getMediosPagoConfig } from "@/modules/config";
import { MediosPagoScreen } from "@/modules/config/components/medios-pago-screen";

export const dynamic = "force-dynamic";

export default async function MediosPagoPage() {
  await requireRol("/config");
  const medios = await getMediosPagoConfig();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Medios de pago</h1>
      {!medios.ok && <p className="text-sm text-destructive">{medios.error}</p>}
      {medios.ok && <MediosPagoScreen medios={medios.data} />}
    </main>
  );
}
