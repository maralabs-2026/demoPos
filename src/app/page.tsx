import { getComercioName } from "@/modules/config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await getComercioName();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {result.ok ? (
        <h1 className="text-3xl font-semibold">{result.data}</h1>
      ) : (
        <p className="text-muted-foreground">{result.error}</p>
      )}
    </main>
  );
}
