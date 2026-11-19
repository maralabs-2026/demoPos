"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
// Imports por archivo y no por el barrel: el index arrastra queries.ts (next/headers) al cliente.
import { splitBrandName } from "@/modules/auth/brand";
import {
  getMobileNav,
  getNavLinks,
  type NavLink,
} from "@/modules/auth/navigation";
import { ROL_LABELS } from "@/modules/auth/roles";
import type { SessionProfile } from "@/modules/auth/session";
import { useMenuLateral } from "./menu-lateral";
import { iniciales, useCerrarSesion } from "./use-cerrar-sesion";

export function AppBrand({
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
      {/* Isotipo del UI kit: tres barras, la del medio en verde. */}
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

function MenuLink({ link, active }: { link: NavLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-12 items-center gap-3 rounded-full pr-4 pl-1.5 text-[15px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-accent font-semibold text-accent-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          active ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      {link.label}
    </Link>
  );
}

// Panel que se abre encima de la pantalla, en todos los tamaños: el contenido usa todo el ancho.
function MenuLateralPanel({
  profile,
  links,
  activeHref,
}: {
  profile: SessionProfile;
  links: readonly NavLink[];
  activeHref: string | undefined;
}) {
  const pathname = usePathname();
  const { abiertoEn, setAbiertoEn } = useMenuLateral();
  const abierto = abiertoEn === pathname;
  const panelRef = useRef<HTMLElement>(null);
  const cerrarSesion = useCerrarSesion();
  const cerrar = () => setAbiertoEn(null);

  useEffect(() => {
    if (!abierto) return;
    // Al cerrar, el foco vuelve a donde estaba (la hamburguesa o "Más").
    const previo = document.activeElement as HTMLElement | null;
    panelRef.current
      ?.querySelector<HTMLElement>("a[aria-current=page], a")
      ?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAbiertoEn(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previo?.focus();
    };
  }, [abierto, setAbiertoEn]);

  if (!abierto) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={cerrar}
        className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] animate-in fade-in-0 print:hidden"
      />
      <aside
        ref={panelRef}
        id="menu-lateral"
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        onClick={(e) => {
          // Elegir una opción cierra el panel, también si es la pantalla actual.
          if ((e.target as HTMLElement).closest("a")) cerrar();
        }}
        className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 bg-sidebar p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-left duration-200 print:hidden"
      >
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-muted p-1.5 pr-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {iniciales(profile.nombre)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {profile.nombre}
              </span>
              <span className="text-xs text-muted-foreground">
                {ROL_LABELS[profile.rol]}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-destructive-soft text-destructive transition-colors hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav
          aria-label="Principal"
          className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1"
        >
          {links.map((link) => (
            <MenuLink
              key={link.href}
              link={link}
              active={activeHref === link.href}
            />
          ))}
        </nav>

        <button
          type="button"
          onClick={cerrarSesion}
          className="flex h-13 items-center justify-between rounded-full bg-muted pr-1.5 pl-4 text-[15px] font-medium transition-colors hover:bg-destructive-soft focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none"
        >
          Cerrar sesión
          <span className="grid size-10 place-items-center rounded-full bg-destructive text-white">
            <LogOut aria-hidden="true" className="size-4" />
          </span>
        </button>
      </aside>
    </>
  );
}

export function Navigation({ profile }: { profile: SessionProfile }) {
  const pathname = usePathname();
  const rol = profile.rol;

  const links = getNavLinks(rol);
  const { barra, mas } = getMobileNav(rol);
  const { abiertoEn, setAbiertoEn } = useMenuLateral();
  const activeHref = links.find(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  )?.href;

  const masActivo = mas.some((link) => link.href === activeHref);

  return (
    <>
      <MenuLateralPanel
        profile={profile}
        links={links}
        activeHref={activeHref}
      />

      {/* Celular y tablet: navegación inferior, a mano del pulgar. "Más" abre el mismo panel. */}
      <nav
        aria-label="Accesos"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center bg-card px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--border),0_-6px_16px_rgba(16,24,40,0.04)] lg:hidden print:hidden"
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
                  "grid h-8 w-12 place-items-center rounded-full transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Icon size={19} aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "text-[11px] leading-none",
                  active
                    ? "font-semibold text-accent-foreground"
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
            aria-expanded={abiertoEn === pathname}
            aria-controls="menu-lateral"
            onClick={() => setAbiertoEn(pathname)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-1"
          >
            <span
              className={cn(
                "grid h-8 w-12 place-items-center rounded-full transition-colors",
                masActivo
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Menu size={19} aria-hidden="true" />
            </span>
            <span
              className={cn(
                "text-[11px] leading-none",
                masActivo
                  ? "font-semibold text-accent-foreground"
                  : "font-medium text-muted-foreground",
              )}
            >
              Más
            </span>
          </button>
        )}
      </nav>
    </>
  );
}
