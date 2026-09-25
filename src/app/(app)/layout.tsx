"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigation } from "@/modules/auth/components/navigation";
import { getMockSession, mustChangePassword } from "@/modules/auth";

export default function AppLayout({
  children,
}: Readonly<{
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
      <Navigation />
      <div className="pb-14 md:pb-0">{children}</div>
    </>
  );
}