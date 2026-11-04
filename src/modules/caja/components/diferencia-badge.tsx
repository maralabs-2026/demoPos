import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { estadoDiferencia } from "../cierre";

export function DiferenciaBadge({ diferencia }: { diferencia: number }) {
  const estado = estadoDiferencia(diferencia);
  if (estado === "cuadra") return <Badge variant="success">Cuadra</Badge>;
  return (
    <Badge variant={estado === "falta" ? "destructive" : "warning"}>
      <span className="tabular-nums">
        {estado === "falta" ? "Falta" : "Sobra"}{" "}
        {formatCurrency(Math.abs(diferencia))}
      </span>
    </Badge>
  );
}
