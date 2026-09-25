"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getMockSession, mustChangePassword } from "@/modules/auth";
import { Navigation } from "@/modules/auth/components/navigation";

export function AppShell({
  comercioNombre,
  children,
}: Readonly<{
  comercioNombre: string;
  children: ReactNode;
}>) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const session = getMockSession();
    if (mustChangePassword(session)) {
      router.replace("/cambiar-contrasena");
      return;
    }
    setAuthorized(true);
  }, [router]);

  if (!authorized) return null;

  return (
    <>
      <Navigation comercioNombre={comercioNombre} />
      <div className="pb-14 md:pb-0">{children}</div>
    </>
  );
}