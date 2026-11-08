import type { ReactNode } from "react";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/stock", label: "Stock" },
  { href: "/stock/reposicion", label: "Reposición" },
  { href: "/stock/auditoria", label: "Auditoría" },
  { href: "/stock/compras", label: "Compras" },
  { href: "/stock/proveedores", label: "Proveedores" },
];

// Las pestañas son para dueño y encargado. Cada página valida su acceso con requireRol.
export default function StockLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        <SectionTabs label="Secciones de stock" tabs={TABS} />
      </div>
      {children}
    </>
  );
}
