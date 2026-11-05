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
      className="flex gap-1 rounded-full border border-border bg-card p-1 print:hidden"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === activa ? "page" : undefined}
          className={cn(
            "flex h-10 flex-1 items-center justify-center rounded-full text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
