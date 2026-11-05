// Mientras carga una pantalla, el menú queda visible y el contenido muestra un esqueleto.
export default function Loading() {
  return (
    <main
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Cargando...
      </p>
      <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
