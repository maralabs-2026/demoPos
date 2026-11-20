import { requireRol } from "@/modules/auth";
import { getControlParaRol } from "@/modules/ayuda";
import { ControlDiario } from "@/modules/ayuda/components/control-diario";
import { todayISO } from "@/lib/date";

export default async function ControlDiarioPage() {
  const profile = await requireRol("/ayuda/control");

  return (
    <ControlDiario
      bloques={getControlParaRol(profile.rol)}
      hoy={todayISO()}
      usuario={profile.email}
    />
  );
}
