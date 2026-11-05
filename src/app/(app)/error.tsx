"use client";

import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Error inesperado dentro de una pantalla: el menú sigue visible y el detalle técnico no se muestra.
// El código sirve para encontrar el error en los registros del servidor.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  function reintentar() {
    // Vuelve a pedir los datos al servidor antes de redibujar la pantalla.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col p-4 sm:p-6 lg:p-8">
      <Card className="gap-4 p-6" role="alert">
        <h1 className="text-2xl">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">
          No pudimos mostrar esta pantalla. Probá de nuevo; si sigue pasando,
          avisale al dueño del comercio.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Código del error: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={reintentar}>Probá de nuevo</Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Volvé al inicio
          </Button>
        </div>
      </Card>
    </main>
  );
}
