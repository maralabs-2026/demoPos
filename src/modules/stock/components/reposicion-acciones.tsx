"use client";

import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export function ReposicionAcciones({
  texto,
  telefono,
}: {
  texto: string;
  // Con teléfono, WhatsApp abre el chat del proveedor; sin él, pide elegir el contacto.
  telefono?: string | null;
}) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Lista copiada", "Pegala donde la necesites.");
    } catch {
      toast.error("No se pudo copiar", "Compartila por WhatsApp.");
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button variant="outline" onClick={copiar}>
        <Copy data-icon="inline-start" />
        Copiá la lista
      </Button>
      <a
        href={enlaceWhatsApp(texto, telefono)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-10 items-center justify-center gap-2 rounded-full border border-input text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        {telefono ? "Mandá el pedido por WhatsApp" : "Compartí por WhatsApp"}
      </a>
    </div>
  );
}
