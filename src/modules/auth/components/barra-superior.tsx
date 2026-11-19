"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatFechaCorta } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { SessionProfile } from "@/modules/auth/session";
import { BotonMenu } from "./menu-lateral";
import { AppBrand } from "./navigation";

// Estado de la caja del usuario: true abierta, false cerrada, null si no se pudo leer (no se
// muestra antes que mostrar algo falso).
export type EstadoCaja = boolean | null;

const pildora =
  "flex h-10 shrink-0 items-center gap-2 rounded-full bg-card px-3.5 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.06)]";

export function BarraSuperior({
  profile,
  cajaAbierta,
}: {
  profile: SessionProfile;
  cajaAbierta: EstadoCaja;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 bg-background/85 px-4 backdrop-blur-md sm:px-6 print:hidden">
      <BotonMenu />
      <div className="min-w-0 flex-1">
        <AppBrand
          comercioNombre={profile.comercio}
          logoUrl={profile.logo_url}
          className="max-h-10"
        />
      </div>

      <span className={cn(pildora, "hidden font-medium sm:flex")}>
        <CalendarDays aria-hidden="true" className="size-4 text-primary" />
        {/* El servidor y el navegador pueden diferir justo a la medianoche. */}
        <span suppressHydrationWarning>{formatFechaCorta()}</span>
      </span>

      {cajaAbierta !== null && (
        <Link
          href="/caja"
          className={cn(
            pildora,
            "transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            cajaAbierta ? "text-success-text" : "text-destructive",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              cajaAbierta ? "bg-success" : "bg-destructive",
            )}
          />
          {cajaAbierta ? "Caja abierta" : "Caja cerrada"}
        </Link>
      )}
    </header>
  );
}
