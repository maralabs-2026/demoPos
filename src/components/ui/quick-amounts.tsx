import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";

// Billetes por defecto del peso argentino. Quien usa el componente puede pasar
// los suyos en `bills`; cuando la moneda se configure por comercio (Fase 7),
// salen de la configuración.
const DEFAULT_BILLS = [1000, 2000, 10000, 20000] as const;

type QuickAmountsProps = {
  total: number;
  onSelect: (amount: number) => void;
  bills?: readonly number[];
  className?: string;
};

/**
 * Atajos de monto recibido: "Exacto" y los billetes mayores al total.
 * Con total 0 no muestra nada.
 */
function QuickAmounts({
  total,
  onSelect,
  bills = DEFAULT_BILLS,
  className,
}: QuickAmountsProps) {
  if (total <= 0) return null;
  const mayores = bills.filter((bill) => bill > total);

  return (
    <div
      data-slot="quick-amounts"
      role="group"
      aria-label="Montos rápidos"
      className={cn("flex flex-wrap gap-2", className)}
    >
      <Button
        type="button"
        variant="outline"
        className="border-primary/40 bg-accent text-primary hover:border-primary"
        size="sm"
        onClick={() => onSelect(total)}
        aria-label={`Exacto, ${formatCurrency(total)}`}
      >
        Exacto
      </Button>
      {mayores.map((bill) => (
        <Button
          key={bill}
          type="button"
          variant="outline"
          size="sm"
          className="tabular-nums"
          onClick={() => onSelect(bill)}
        >
          {formatCurrency(bill, { decimals: 0 })}
        </Button>
      ))}
    </div>
  );
}

export { QuickAmounts };
