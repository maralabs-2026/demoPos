import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center p-4">
      <Card className="gap-4 p-6">
        <h1 className="text-2xl">No encontramos esta página</h1>
        <p className="text-sm text-muted-foreground">
          Puede que la dirección esté mal escrita o que la página ya no exista.
        </p>
        <Button nativeButton={false} render={<Link href="/" />}>
          Volvé al inicio
        </Button>
      </Card>
    </main>
  );
}
