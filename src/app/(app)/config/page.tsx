import { requireRol } from "@/modules/auth";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  await requireRol("/config");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-2 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Configuración</h1>
      <p className="text-sm text-muted-foreground">
        Próximamente: datos del ticket, medios de pago, categorías y usuarios
        (Fase 7).
      </p>
    </main>
  );
}
