"use client";

import type { ReactNode } from "react";
import { Navigation } from "@/modules/auth/components/navigation";
import type { SessionProfile } from "@/modules/auth/session";

export function AppShell({
  profile,
  children,
}: Readonly<{
  profile: SessionProfile;
  children: ReactNode;
}>) {
  return (
    <>
      <Navigation profile={profile} />
      <div className="pb-14 md:pb-0">{children}</div>
    </>
  );
}
