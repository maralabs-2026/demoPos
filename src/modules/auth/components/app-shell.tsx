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
  // Navigation no se muestra sin rol: en ese caso tampoco se reserva su espacio.
  const [conNavegacion, setConNavegacion] = useState(false);

  useEffect(() => {
    const session = getMockSession();
    if (mustChangePassword(session)) {
      router.replace("/cambiar-contrasena");
      return;
    }
    setConNavegacion(Boolean(session?.rol));
    setAuthorized(true);
  }, [router]);

  if (!authorized) return null;

  return (
    <>
      <Navigation comercioNombre={comercioNombre} />
      <div className={conNavegacion ? "pb-16 lg:pb-0 lg:pl-60" : undefined}>
        {children}
      </div>
    </>
  );
}
