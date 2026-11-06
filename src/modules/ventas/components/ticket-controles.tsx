"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import type { Comprobante } from "../actions";
import {
  enlaceWhatsApp,
  numeroTicket,
  ticketComoTexto,
  type TicketTextos,
} from "../ticket";

// Papel y ancho imprimible en mm: el rollo tiene márgenes que la impresora no alcanza.
const ANCHOS = { 58: 52, 80: 72 } as const;
type Papel = keyof typeof ANCHOS;

function TicketImpreso({
  venta,
  textos,
  logoUrl,
  papel,
}: {
  venta: Comprobante;
  textos: TicketTextos;
  logoUrl: string | null;
  papel: Papel;
}) {
  return (
    <div
      className="ticket-print hidden font-mono text-[11px] leading-snug text-black print:block"
      style={{ width: `${ANCHOS[papel]}mm` }}
    >
      {/* El tamaño de página depende del papel elegido: no se puede fijar en el CSS global. */}
      <style>{`@media print { @page { size: ${papel}mm auto; margin: 0; } }`}</style>
      {logoUrl && (
        // En grises: la impresora térmica no tiene color, y así se controla cómo sale.
        <Image
          unoptimized
          src={logoUrl}
          alt=""
          width={480}
          height={240}
          className="mx-auto mb-1 h-auto max-h-24 w-auto max-w-[80%] object-contain grayscale"
        />
      )}
      {textos.titulo && (
        <p className="text-center text-sm font-bold">{textos.titulo}</p>
      )}
      <p className="text-center">Ticket {numeroTicket(venta.ventaId)}</p>
      <p className="mb-1 border-b border-dashed border-black pb-1 text-center">
        {formatDateTime(venta.fecha)}
      </p>
      {venta.items.map((item, i) => (
        <div key={i} className="py-0.5">
          <p className="break-words">
            {item.cantidad} × {item.nombre}
          </p>
          {item.promocion && <p>Promo: {item.promocion}</p>}
          {item.descuento > 0 && (
            <p>Descuento − {formatCurrency(item.descuento)}</p>
          )}
          <p className="text-right">{formatCurrency(item.subtotal)}</p>
        </div>
      ))}
      <div className="mt-1 border-t border-dashed border-black pt-1">
        {venta.descuentoTotal > 0 && (
          <p className="flex justify-between">
            <span>Descuento</span>
            <span>− {formatCurrency(venta.descuentoTotal)}</span>
          </p>
        )}
        <p className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{formatCurrency(venta.total)}</span>
        </p>
        <p className="flex justify-between gap-2">
          <span>Pago</span>
          <span className="text-right">{venta.medioPagoNombre}</span>
        </p>
        {venta.vuelto !== null && venta.vuelto > 0 && (
          <p className="flex justify-between">
            <span>Vuelto</span>
            <span>{formatCurrency(venta.vuelto)}</span>
          </p>
        )}
      </div>
      {(textos.leyenda || textos.pie) && (
        <div className="mt-2 border-t border-dashed border-black pt-1 text-center">
          {textos.leyenda && <p>{textos.leyenda}</p>}
          {textos.pie && <p>{textos.pie}</p>}
        </div>
      )}
    </div>
  );
}

export function TicketControles({
  venta,
  textos,
  logoUrl,
}: {
  venta: Comprobante;
  textos: TicketTextos;
  logoUrl: string | null;
}) {
  const [papel, setPapel] = useState<Papel>(80);

  function imprimir(elegido: Papel) {
    // El ticket tiene que tener el ancho elegido antes de abrir el diálogo de impresión.
    flushSync(() => setPapel(elegido));
    window.print();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 print:hidden">
        <Button variant="outline" onClick={() => imprimir(58)}>
          <Printer data-icon="inline-start" />
          Imprimí 58 mm
        </Button>
        <Button variant="outline" onClick={() => imprimir(80)}>
          <Printer data-icon="inline-start" />
          Imprimí 80 mm
        </Button>
      </div>
      <a
        href={enlaceWhatsApp(ticketComoTexto(venta, textos))}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-10 items-center justify-center gap-2 rounded-full border border-input text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        Compartí por WhatsApp
      </a>
      <TicketImpreso
        venta={venta}
        textos={textos}
        logoUrl={logoUrl}
        papel={papel}
      />
    </div>
  );
}
