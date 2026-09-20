import { Button } from "@/components/ui/button";
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
    <div className="mx-auto max-w-sm space-y-6 rounded-lg border p-6">
      <div className="text-center">
        <p className="text-lg font-semibold">Venta cobrada</p>
        <p className="text-muted-foreground text-xs">{fecha}</p>
      </div>

      <ul className="divide-y text-sm">
        {comprobante.items.map((item, idx) => (
          <li key={idx} className="flex justify-between py-2">
            <span>
              {item.cantidad} × {item.nombre}
            </span>
            <span>{formatCurrency(item.subtotal)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t pt-4 text-sm">
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatCurrency(comprobante.total)}</span>
        </div>
        <div className="text-muted-foreground flex justify-between">
          <span>Medio de pago</span>
          <span>{comprobante.medioPagoNombre}</span>
        </div>
        {comprobante.vuelto !== null && (
          <div className="flex justify-between font-medium">
            <span>Vuelto</span>
            <span>{formatCurrency(comprobante.vuelto)}</span>
          </div>
        )}
      </div>

      <Button className="w-full" size="lg" onClick={onNuevaVenta}>
        Nueva venta
      </Button>
    </div>
  );
}
