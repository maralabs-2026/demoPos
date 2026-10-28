import { requireRol } from "@/modules/auth";

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  await requireRol("/reportes");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-2 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl">Reportes</h1>
      <p className="text-sm text-muted-foreground">
        Próximamente: ventas por día, semana y mes, ranking de productos y
        ganancia estimada (Fase 6).
      </p>
    </main>
  );
}
