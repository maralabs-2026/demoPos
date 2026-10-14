"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getMockSession, splitBrandName, type Rol } from "@/modules/auth";
import { getNavLinks, type NavLink } from "@/modules/auth/navigation";

const rolLabels: Record<Rol, string> = {
  dueno: "Dueño",
  encargado: "Encargado",
  cajero: "Cajero",
};

function AppBrand({ comercioNombre }: { comercioNombre: string }) {
  const { first, rest } = splitBrandName(comercioNombre);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {/* Isotipo del UI kit: tres barras, la del medio en lima. */}
      <div
        aria-hidden="true"
        className="flex h-7 shrink-0 items-center gap-0.5"
      >
        <span className="h-5 w-1.5 rounded-full bg-primary" />
        <span className="h-7 w-1.5 rounded-full bg-success" />
        <span className="h-4 w-1.5 rounded-full bg-primary" />
      </div>
      <span className="truncate text-lg font-bold tracking-tight">
        {first}
        {rest ? <span className="text-primary"> {rest}</span> : null}
      </span>
    </div>
  );
}

function RoleBadge({ rol }: { rol: Rol }) {
  return (
    <Badge variant={rol === "dueno" ? "info" : "neutral"}>
      {rolLabels[rol]}
    </Badge>
  );
}

function SidebarLink({ link, active }: { link: NavLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        active
          ? "bg-accent font-bold text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon size={18} aria-hidden="true" />
      {link.label}
      {active && (
        <span
          aria-hidden="true"
          className="absolute right-0 h-4.5 w-[3px] rounded-l-sm bg-primary"
        />
      )}
    </Link>
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

  return (
    <>
      {/* Escritorio: barra lateral fija */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-4 pt-7 pb-5 lg:flex">
        <div className="px-2">
          <AppBrand comercioNombre={comercioNombre} />
        </div>
        <nav aria-label="Principal" className="mt-8 flex flex-col gap-1">
          <span className="px-3 pb-2 text-[0.625rem] font-bold tracking-widest text-muted-foreground uppercase">
            Menú
          </span>
          {links.map((link) => (
            <SidebarLink
              key={link.href}
              link={link}
              active={activeHref === link.href}
            />
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-border px-1 pt-4">
          <span className="text-xs text-muted-foreground">Ingresaste como</span>
          <RoleBadge rol={rol} />
        </div>
      </aside>

      {/* Celular y tablet: cabecera */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-border bg-card/90 px-4 backdrop-blur-md lg:hidden">
        <AppBrand comercioNombre={comercioNombre} />
        <RoleBadge rol={rol} />
      </header>

      {/* Celular y tablet: navegación inferior */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-border bg-card px-2 lg:hidden"
      >
        {links.map((link) => {
          const active = activeHref === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-1"
            >
              <span
                className={cn(
                  "grid h-7 w-12 place-items-center rounded-full transition-colors",
                  active ? "bg-accent text-primary" : "text-muted-foreground",
                )}
              >
                <Icon size={19} aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none",
                  active
                    ? "font-bold text-primary"
                    : "font-medium text-muted-foreground",
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
