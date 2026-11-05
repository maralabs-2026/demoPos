import type { ReactNode } from "react";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/reportes", label: "Reportes" },
  { href: "/reportes/ventas", label: "Ventas" },
];

// Las dos pestañas son para dueño y encargado. Cada página valida su acceso con requireRol.
export default function ReportesLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 print:hidden">
        <SectionTabs label="Secciones de reportes" tabs={TABS} />
      </div>
      {children}
    </>
  );
}
