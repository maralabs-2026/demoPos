import type { ReactNode } from "react";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/config", label: "Comercio" },
  { href: "/config/ticket", label: "Ticket" },
  { href: "/config/pagos", label: "Pagos" },
  { href: "/config/categorias", label: "Categorías" },
];

// Las pestañas son del dueño. Cada página valida su acceso con requireRol.
export default function ConfigLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        <SectionTabs label="Secciones de configuración" tabs={TABS} />
      </div>
      {children}
    </>
  );
}
