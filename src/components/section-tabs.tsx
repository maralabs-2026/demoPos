"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTabHref, type SectionTab } from "@/lib/section-tabs";
import { cn } from "@/lib/utils";

export function SectionTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: SectionTab[];
}) {
  const activa = activeTabHref(tabs, usePathname());

  return (
    <nav
      aria-label={label}
      // Si las pestañas no entran (celular de 360 px), la barra se desplaza de costado en vez de
      // cortar los nombres.
      className="flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none] print:hidden"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === activa ? "page" : undefined}
          className={cn(
            "flex h-10 min-w-fit flex-1 items-center justify-center rounded-full px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            tab.href === activa
              ? "bg-accent font-bold text-primary"
              : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
