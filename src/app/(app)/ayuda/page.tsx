import { requireRol } from "@/modules/auth";
import { getGuiasParaRol } from "@/modules/ayuda";
import { AyudaScreen } from "@/modules/ayuda/components/ayuda-screen";

export default async function AyudaPage() {
  const profile = await requireRol("/ayuda");

  return <AyudaScreen guias={getGuiasParaRol(profile.rol)} />;
}
