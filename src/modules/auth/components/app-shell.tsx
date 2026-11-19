"use client";

import type { ReactNode } from "react";
import { Navigation } from "@/modules/auth/components/navigation";
import { MenuLateralProvider } from "@/modules/auth/components/menu-lateral";
import {
  BarraSuperior,
  type EstadoCaja,
} from "@/modules/auth/components/barra-superior";
import type { SessionProfile } from "@/modules/auth/session";

export function AppShell({
  profile,
  cajaAbierta,
  children,
}: Readonly<{
  profile: SessionProfile;
  cajaAbierta: EstadoCaja;
  children: ReactNode;
}>) {
  // Sin barra lateral fija: el menú se abre encima y el contenido usa todo el ancho.
  return (
    <MenuLateralProvider>
      <Navigation profile={profile} />
      <BarraSuperior profile={profile} cajaAbierta={cajaAbierta} />
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>
    </MenuLateralProvider>
  );
}
