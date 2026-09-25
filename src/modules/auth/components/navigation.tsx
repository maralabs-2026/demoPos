"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getMockSession, splitBrandName, type Rol } from "@/modules/auth";
import { getNavLinks } from "@/modules/auth/navigation";

const badgeStyles: Record<Rol, string> = {
  dueno: "bg-[#533AFD1A] text-[#533AFD]",
  encargado: "bg-[#C8DFFE] text-[#4D627D]",
  cajero: "bg-[#E2EFFE] text-[#4D627D]",
};

const badgeLabels: Record<Rol, string> = {
  dueno: "Dueño",
  encargado: "ENCARGADO",
  cajero: "CAJERO",
};

const showsAvatar: Record<Rol, boolean> = {
  dueno: false,
  encargado: true,
  cajero: true,
};

function AppBrand({ comercioNombre }: { comercioNombre: string }) {
  const { monogram, first, rest } = splitBrandName(comercioNombre);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#533AFD] md:h-10 md:w-10 md:rounded-[10px]">
        <span className="text-base font-extrabold text-white md:text-xl">
          {monogram || "P"}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-extrabold tracking-tight text-[#0D253D] md:text-2xl">
          {first}
        </span>
        {rest ? (
          <span className="text-lg font-bold tracking-tight text-[#533AFD] md:text-2xl">
            {rest}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RoleBadge({ rol }: { rol: Rol }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold",
        badgeStyles[rol],
      )}
    >
      {badgeLabels[rol]}
    </span>
  );
}

function Avatar({ rol }: { rol: Rol }) {
  if (!showsAvatar[rol]) return null;
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3904E7] text-white">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </svg>
    </div>
  );
}

export function Navigation({ comercioNombre }: { comercioNombre: string }) {
  const pathname = usePathname();
  const [rol, setRol] = useState<Rol | null>(null);

  useEffect(() => {
    const session = getMockSession();
    if (session && !session.mustChangePassword) {
      setRol(session.rol);
    }
  }, []);

  if (!rol) return null;

  const links = getNavLinks(rol);
  const activeHref = links.find((link) => pathname === link.href)?.href;
  const hasIcons = rol === "dueno";

  return (
    <>
      {/* Desktop header */}
      <header
        className={cn(
          "sticky top-0 z-40 hidden items-center justify-between gap-4 border-b bg-background px-6 md:flex",
          rol === "dueno" ? "h-20" : "h-16",
        )}
      >
        <div className="flex items-center gap-3">
          <AppBrand comercioNombre={comercioNombre} />
          <RoleBadge rol={rol} />
        </div>

        {hasIcons ? (
          <nav className="flex items-center gap-2">
            {links.map((link) => {
              const active = activeHref === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-[#533AFD] text-white"
                      : "text-[#0D253D] hover:bg-muted",
                  )}
                >
                  <Icon size={16} className={active ? "text-white" : "text-[#5B6B7A]"} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const active = activeHref === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors",
                    active ? "bg-[#533AFD] text-white" : "text-[#474556] hover:bg-muted",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}

        <Avatar rol={rol} />
      </header>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b bg-background px-4 md:hidden">
        <AppBrand comercioNombre={comercioNombre} />
        <div className="flex items-center gap-2">
          <RoleBadge rol={rol} />
          <Avatar rol={rol} />
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[60px] items-center border-t bg-background px-2 md:hidden">
        {links.map((link) => {
          const active = activeHref === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1"
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.2 : 1.8}
                className={active ? "text-[#533AFD]" : "text-[#5B6B7A]"}
              />
              <span
                className={cn(
                  "text-[10px] leading-none",
                  active ? "font-bold text-[#533AFD]" : "font-medium text-[#5B6B7A]",
                )}
              >
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
