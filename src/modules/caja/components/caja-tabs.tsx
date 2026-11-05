"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type CajaTab = { href: string; label: string };

// "/caja" es la pestaña de la caja en curso, también cuando se opera la de otro (/caja/cerrar/...).
function esActiva(href: string, pathname: string): boolean {
  if (href === "/caja") {
    return pathname === "/caja" || pathname.startsWith("/caja/cerrar/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CajaTabs({ tabs }: { tabs: CajaTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de caja"
      className="flex gap-1 rounded-full border border-border bg-card p-1"
    >
      {tabs.map((tab) => {
        const activa = esActiva(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "flex h-10 flex-1 items-center justify-center rounded-full text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              activa
                ? "bg-accent font-bold text-primary"
                : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
