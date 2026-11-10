"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
// Imports por archivo y no por el barrel: el index arrastra queries.ts (next/headers) al cliente.
import { splitBrandName } from "@/modules/auth/brand";
import {
  getMobileNav,
  getNavLinks,
  type NavLink,
} from "@/modules/auth/navigation";
import { ROL_LABELS, rolBadgeVariant } from "@/modules/auth/roles";
import type { Rol, SessionProfile } from "@/modules/auth/session";
import { esPantallaCompleta, useMenuLateral } from "./menu-lateral";

function AppBrand({
  comercioNombre,
  logoUrl,
  className,
}: {
  comercioNombre: string;
  logoUrl: string | null;
  className?: string;
}) {
  // Con logo, la imagen reemplaza al nombre; el nombre queda como texto alternativo.
  if (logoUrl) {
    return (
      <Image
        unoptimized
        src={logoUrl}
        alt={comercioNombre}
        width={480}
        height={240}
        className={cn("w-auto max-w-full object-contain", className)}
      />
    );
  }

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
  return <Badge variant={rolBadgeVariant(rol)}>{ROL_LABELS[rol]}</Badge>;
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

export function Navigation({ profile }: { profile: SessionProfile }) {
  const pathname = usePathname();
  const rol = profile.rol;
  const comercioNombre = profile.comercio;
  const logoUrl = profile.logo_url;

  const links = getNavLinks(rol);
  const { barra, mas } = getMobileNav(rol);
  const [masAbierto, setMasAbierto] = useState(false);
  const activeHref = links.find(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  )?.href;

  const masActivo = mas.some((link) => link.href === activeHref);

  // En el punto de venta la barra no queda fija: se abre encima con el botón Menú.
  const flotante = esPantallaCompleta(pathname);
  const { abiertoEn, setAbiertoEn } = useMenuLateral();
  const menuAbierto = flotante && abiertoEn === pathname;
  const asideRef = useRef<HTMLElement>(null);
  const cerrarMenu = () => setAbiertoEn(null);

  useEffect(() => {
    if (!menuAbierto) return;
    asideRef.current?.querySelector<HTMLElement>("a")?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAbiertoEn(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuAbierto, setAbiertoEn]);

  return (
    <>
      {menuAbierto && (
        <div
          aria-hidden="true"
          onClick={cerrarMenu}
          className="fixed inset-0 z-40 hidden bg-foreground/40 lg:block"
        />
      )}

      {/* Escritorio: barra lateral fija; en el punto de venta, panel que se abre encima. */}
      <aside
        ref={asideRef}
        id="menu-lateral"
        role={flotante ? "dialog" : undefined}
        aria-modal={menuAbierto ? true : undefined}
        aria-label={flotante ? "Menú" : undefined}
        onClick={(e) => {
          // Elegir una opción cierra el panel, también si es la pantalla actual.
          if ((e.target as HTMLElement).closest("a")) cerrarMenu();
        }}
        className={cn(
          "fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-4 pt-7 pb-5",
          flotante
            ? cn("z-50 shadow-xl", menuAbierto && "lg:flex")
            : "z-40 lg:flex",
        )}
      >
        <div className="px-2">
          <AppBrand
            comercioNombre={comercioNombre}
            logoUrl={logoUrl}
            className="max-h-24"
          />
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
        <AppBrand
          comercioNombre={comercioNombre}
          logoUrl={logoUrl}
          className="max-h-11"
        />
        <RoleBadge rol={rol} />
      </header>

      {/* Celular y tablet: navegación inferior */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        {barra.map((link) => {
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
        {mas.length > 0 && (
          <button
            type="button"
            onClick={() => setMasAbierto(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-1"
          >
            <span
              className={cn(
                "grid h-7 w-12 place-items-center rounded-full transition-colors",
                masActivo ? "bg-accent text-primary" : "text-muted-foreground",
              )}
            >
              <Menu size={19} aria-hidden="true" />
            </span>
            <span
              className={cn(
                "text-[10px] leading-none",
                masActivo
                  ? "font-bold text-primary"
                  : "font-medium text-muted-foreground",
              )}
            >
              Más
            </span>
          </button>
        )}
      </nav>

      <Dialog open={masAbierto} onOpenChange={setMasAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Más opciones</DialogTitle>
          </DialogHeader>
          <nav aria-label="Más opciones" className="flex flex-col gap-1">
            {mas.map((link) => (
              <span key={link.href} onClick={() => setMasAbierto(false)}>
                <SidebarLink link={link} active={activeHref === link.href} />
              </span>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
}
