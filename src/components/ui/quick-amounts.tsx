import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";

// TODO(demo): los billetes salen de la configuración del comercio en Fase 7.
const DEFAULT_BILLS = [1000, 2000, 10000, 20000] as const;

const compact = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

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
        variant="secondary"
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
          $ {compact.format(bill)}
        </Button>
      ))}
    </div>
  );
}

export { QuickAmounts };
