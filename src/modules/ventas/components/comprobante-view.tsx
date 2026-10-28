import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { Comprobante } from "../actions";

export function ComprobanteView({
  comprobante,
  onNuevaVenta,
}: {
  comprobante: Comprobante;
  onNuevaVenta: () => void;
}) {
  const fecha = new Date(comprobante.fecha).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Cordoba",
  });

  return (
    <Card className="mx-auto max-w-sm gap-5 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success text-success-foreground">
          <Check aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-xl">Venta cobrada</h2>
        <p className="text-xs text-muted-foreground">{fecha}</p>
      </div>

      <div>
        <CardEyebrow>Detalle</CardEyebrow>
        <ul className="mt-1 text-sm">
          {comprobante.items.map((item, idx) => (
            <li
              key={idx}
              className="flex justify-between gap-3 border-b border-border py-2.5"
            >
              <span>
                {item.cantidad} × {item.nombre}
                {item.descuento > 0 && (
                  <span className="block text-xs text-success-text">
                    Descuento − {formatCurrency(item.descuento)}
                  </span>
                )}
              </span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(item.subtotal)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-dashed border-input pt-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Medio de pago</span>
          <span className="font-semibold text-foreground">
            {comprobante.medioPagoNombre}
          </span>
        </div>
        {comprobante.descuentoTotal > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Descuento sobre el total</span>
            <span className="font-semibold text-success-text tabular-nums">
              − {formatCurrency(comprobante.descuentoTotal)}
            </span>
          </div>
        )}
        {comprobante.vuelto !== null && (
          <div className="flex justify-between text-muted-foreground">
            <span>Vuelto</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatCurrency(comprobante.vuelto)}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-2">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {formatCurrency(comprobante.total)}
          </span>
        </div>
      </div>

      <Button autoFocus className="w-full" size="lg" onClick={onNuevaVenta}>
        Nueva venta
      </Button>
    </Card>
  );
}
