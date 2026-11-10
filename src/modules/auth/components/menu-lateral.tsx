"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

// Pantallas de escritorio sin barra lateral fija: el menú se abre como panel encima.
export function esPantallaCompleta(pathname: string): boolean {
  return pathname === "/vender" || pathname.startsWith("/vender/");
}

type MenuLateral = {
  // Pantalla donde se abrió: al cambiar de pantalla, el panel queda cerrado solo.
  abiertoEn: string | null;
  setAbiertoEn: (pathname: string | null) => void;
};

const MenuLateralContext = createContext<MenuLateral | null>(null);

export function MenuLateralProvider({ children }: { children: ReactNode }) {
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  return (
    <MenuLateralContext.Provider value={{ abiertoEn, setAbiertoEn }}>
      {children}
    </MenuLateralContext.Provider>
  );
}

export function useMenuLateral(): MenuLateral {
  const ctx = useContext(MenuLateralContext);
  if (!ctx) throw new Error("useMenuLateral fuera de MenuLateralProvider");
  return ctx;
}

// Abre el menú en las pantallas sin barra lateral fija.
export function BotonMenu({ className }: { className?: string }) {
  const pathname = usePathname();
  const { abiertoEn, setAbiertoEn } = useMenuLateral();
  return (
    <button
      type="button"
      aria-expanded={abiertoEn === pathname}
      aria-controls="menu-lateral"
      onClick={() => setAbiertoEn(pathname)}
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      <Menu aria-hidden="true" className="size-4" />
      Menú
    </button>
  );
}
