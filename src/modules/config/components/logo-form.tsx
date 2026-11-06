"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { LOGO_MAX_BYTES, LOGO_TIPOS } from "@/lib/logo";
import { guardarLogo, quitarLogo } from "../actions";

const ACEPTA = Object.values(LOGO_TIPOS).join(",");

export function LogoForm({
  logoUrl,
  nombre,
}: {
  logoUrl: string | null;
  nombre: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleArchivo(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo || isPending) return;
    setError(null);
    if (archivo.size > LOGO_MAX_BYTES) {
      setError("La imagen puede pesar hasta 512 KB");
      return;
    }

    const formData = new FormData();
    formData.set("logo", archivo);
    startTransition(async () => {
      const result = await guardarLogo(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Logo guardado");
      router.refresh();
    });
  }

  function handleQuitar() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await quitarLogo();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Logo quitado");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-lg gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Logo</h2>
        <p className="text-xs text-muted-foreground">
          PNG, JPG o WebP de hasta 512 KB. Un PNG con fondo transparente queda
          mejor. En el ticket impreso sale en grises.
        </p>
      </div>

      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-3">
        {logoUrl ? (
          // Sin optimizar, como las fotos de producto: el logo ya es chico.
          <Image
            unoptimized
            src={logoUrl}
            alt={`Logo de ${nombre}`}
            width={480}
            height={240}
            className="h-full w-auto max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no hay logo.</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACEPTA}
        className="sr-only"
        aria-label="Archivo del logo"
        tabIndex={-1}
        onChange={handleArchivo}
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp aria-hidden="true" />
          {isPending
            ? "Guardando..."
            : logoUrl
              ? "Cambiá el logo"
              : "Subí el logo"}
        </Button>
        {logoUrl && (
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleQuitar}
          >
            <Trash2 aria-hidden="true" />
            Quitá el logo
          </Button>
        )}
      </div>
    </Card>
  );
}
