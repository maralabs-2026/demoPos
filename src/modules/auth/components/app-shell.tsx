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
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
        {children}
      </div>
    </>
  );
}
