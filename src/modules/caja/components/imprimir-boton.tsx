"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Abre la impresión del navegador; desde ahí también se guarda como PDF.
export function ImprimirBoton({ children }: { children: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer aria-hidden="true" />
      {children}
    </Button>
  );
}
