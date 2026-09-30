import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/modules/auth/components/app-shell";
import { getAuthProfile } from "@/modules/auth/queries";
import { mustChangePassword } from "@/modules/auth/session-guard";

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
