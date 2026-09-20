"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/vender", label: "Vender" },
  { href: "/productos", label: "Productos" },
];

export function NavBar({ comercioNombre }: { comercioNombre: string }) {
  const pathname = usePathname();

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6"
      style={{
        // Banda de gradiente de marca (única superficie "hero" de la app).
        backgroundImage:
          "linear-gradient(90deg, #f5e9d4 0%, #f6c99a 20%, #b9b9f9 45%, #533afd 70%, #ea2261 100%)",
      }}
    >
      <span className="text-xl font-light tracking-tight text-white drop-shadow-sm">
        {comercioNombre}
      </span>
      <nav className="flex gap-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-normal",
                active
                  ? "bg-white text-primary"
                  : "text-white/90 hover:bg-white/20",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
