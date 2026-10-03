import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthProfile, mustChangePassword } from "@/modules/auth";
import { AppShell } from "@/modules/auth/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const profile = await getAuthProfile();
  if (!profile) redirect("/login");
  if (mustChangePassword(profile)) redirect("/cambiar-contrasena");

  return <AppShell profile={profile}>{children}</AppShell>;
}
