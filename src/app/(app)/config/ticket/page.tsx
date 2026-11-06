import { requireRol } from "@/modules/auth";
import { getTicketConfig } from "@/modules/config";
import { TicketForm } from "@/modules/config/components/ticket-form";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const profile = await requireRol("/config");
  const ticket = await getTicketConfig();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Los textos que salen en el ticket impreso y por WhatsApp.
        </p>
      </div>
      {!ticket.ok && <p className="text-sm text-destructive">{ticket.error}</p>}
      {ticket.ok && (
        <TicketForm
          inicial={{
            ...ticket.data,
            titulo: ticket.data.titulo || profile.comercio,
          }}
        />
      )}
    </main>
  );
}
