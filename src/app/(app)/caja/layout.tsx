import type { ReactNode } from "react";
import { SectionTabs } from "@/components/section-tabs";
import { canAccess, getAuthProfile, type AppRoute } from "@/modules/auth";

const TABS: { href: AppRoute; label: string }[] = [
  { href: "/caja", label: "Caja" },
  { href: "/caja/gastos", label: "Gastos" },
  { href: "/caja/historial", label: "Historial" },
];

// Pestañas de toda la sección. Cada página sigue validando su propio acceso con requireRol.
export default async function CajaLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const profile = await getAuthProfile();
  const tabs = profile
    ? TABS.filter((tab) => canAccess(profile.rol, tab.href))
    : [];

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <SectionTabs label="Secciones de caja" tabs={tabs} />
      </div>
      {children}
    </>
  );
}
