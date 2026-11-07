"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { marcarVentaRevisada } from "../actions";

export function MarcarRevisada({ ventaId }: { ventaId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function marcar() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await marcarVentaRevisada(ventaId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Venta revisada");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={marcar} disabled={isPending}>
        <CheckCheck data-icon="inline-start" />
        {isPending ? "Marcando..." : "Marcá como revisada"}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
