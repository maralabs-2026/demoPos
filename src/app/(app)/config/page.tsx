import { requireRol } from "@/modules/auth";
import { ComercioForm } from "@/modules/config/components/comercio-form";
import { LogoForm } from "@/modules/config/components/logo-form";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const profile = await requireRol("/config");

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
    </main>
  );
}
