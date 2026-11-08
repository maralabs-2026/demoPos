import { requireRol } from "@/modules/auth";
import { getAvisoVencimiento, getCorteDiaComercial } from "@/modules/config";
import { AvisoVencimientoForm } from "@/modules/config/components/aviso-vencimiento-form";
import { DiaComercialForm } from "@/modules/config/components/dia-comercial-form";
import { ComercioForm } from "@/modules/config/components/comercio-form";
import { LogoForm } from "@/modules/config/components/logo-form";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const profile = await requireRol("/config");
  const [corte, aviso] = await Promise.all([
    getCorteDiaComercial(),
    getAvisoVencimiento(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          El nombre y el logo se ven en el menú y en el ticket impreso.
        </p>
      </div>
      <ComercioForm nombreInicial={profile.comercio} />
      <LogoForm logoUrl={profile.logo_url} nombre={profile.comercio} />
      {!corte.ok && <p className="text-sm text-destructive">{corte.error}</p>}
      {corte.ok && <DiaComercialForm inicial={corte.data} />}
      {!aviso.ok && <p className="text-sm text-destructive">{aviso.error}</p>}
      {aviso.ok && <AvisoVencimientoForm inicial={aviso.data} />}
    </main>
  );
}
