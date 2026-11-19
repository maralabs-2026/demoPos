"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Hamburguesa de la barra superior: abre el panel con todas las pantallas.
export function BotonMenu({ className }: { className?: string }) {
  const pathname = usePathname();
  const { abiertoEn, setAbiertoEn } = useMenuLateral();
  return (
    <button
      type="button"
      aria-label="Abrir menú"
      aria-expanded={abiertoEn === pathname}
      aria-controls="menu-lateral"
      onClick={() => setAbiertoEn(pathname)}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-card text-primary shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      <Menu aria-hidden="true" className="size-5" />
    </button>
  );
}
