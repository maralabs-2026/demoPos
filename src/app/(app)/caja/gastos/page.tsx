import { requireRol } from "@/modules/auth";
import { getCajasParaPagar, getGastos } from "@/modules/caja";
import { GastosScreen } from "@/modules/caja/components/gastos-screen";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function GastosPage() {
  await requireRol("/caja/gastos");

  const [gastos, cajas] = await Promise.all([getGastos(), getCajasParaPagar()]);
  const error = !gastos.ok ? gastos.error : !cajas.ok ? cajas.error : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Gastos</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {gastos.ok && cajas.ok && (
        <GastosScreen
          porPagar={gastos.data.porPagar}
          resueltos={gastos.data.resueltos}
          cajas={cajas.data}
          hoy={todayISO()}
        />
      )}
    </main>
  );
}
