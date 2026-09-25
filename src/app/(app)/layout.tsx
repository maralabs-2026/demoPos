import type { ReactNode } from "react";
import { getComercioName } from "@/modules/config";
import { AppShell } from "@/modules/auth/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const comercioResult = await getComercioName();
  const comercioNombre = comercioResult.ok ? comercioResult.data : "Punto de Venta";

  return <AppShell comercioNombre={comercioNombre}>{children}</AppShell>;
}