"use client";

import "./globals.css";

// Último recurso: falla el layout raíz. Reemplaza todo el documento, así que trae su propio html.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-AR">
      <body className="antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 p-4">
          <h1 className="text-2xl font-semibold">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground">
            No pudimos cargar el sistema. Probá de nuevo en unos segundos.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Código del error:{" "}
              <span className="font-mono">{error.digest}</span>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="h-12 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
          >
            Probá de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
