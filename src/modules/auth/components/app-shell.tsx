"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@/modules/auth/components/navigation";
import {
  esPantallaCompleta,
  MenuLateralProvider,
} from "@/modules/auth/components/menu-lateral";
import type { SessionProfile } from "@/modules/auth/session";
import { cn } from "@/lib/utils";

export function AppShell({
  profile,
  children,
}: Readonly<{
  profile: SessionProfile;
  children: ReactNode;
}>) {
  const pathname = usePathname();
  return (
    <MenuLateralProvider>
      <Navigation profile={profile} />
      <div
        className={cn(
          "pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0",
          // En el punto de venta la pantalla usa todo el ancho: el menú se abre encima.
          !esPantallaCompleta(pathname) && "lg:pl-60",
        )}
      >
        {children}
      </div>
    </MenuLateralProvider>
  );
}
