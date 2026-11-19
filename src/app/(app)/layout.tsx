import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthProfile, mustChangePassword } from "@/modules/auth";
import { getCajaAbierta } from "@/modules/caja";
import { RegistrarSW } from "@/components/registrar-sw";
import { AppShell } from "@/modules/auth/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // En paralelo: la caja solo sirve para la píldora de la barra superior.
  const [profile, caja] = await Promise.all([
    getAuthProfile(),
    getCajaAbierta(),
  ]);
  if (!profile) redirect("/login");
  if (mustChangePassword(profile)) redirect("/cambiar-contrasena");

  return (
    <AppShell
      profile={profile}
      cajaAbierta={caja.ok ? caja.data !== null : null}
    >
      <RegistrarSW />
      {children}
    </AppShell>
  );
}
