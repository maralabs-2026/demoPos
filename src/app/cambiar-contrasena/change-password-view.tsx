"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";
import { getMockSession, storeMockSession } from "@/modules/auth";

export function ChangePasswordView() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);

  useEffect(() => {
    const session = getMockSession();
    if (!session || !session.mustChangePassword) {
      router.replace("/login");
      return;
    }
    setEmail(session.email);
    setCurrentPassword(session.password);
  }, [router]);

  return (
    <main className="flex min-h-dvh w-full flex-col p-6 md:items-center md:justify-center md:px-0 md:py-0">
      {email && currentPassword && (
        <ChangePasswordForm
          email={email}
          currentPassword={currentPassword}
          onSuccess={(usuario) => {
            storeMockSession(usuario);
            router.push("/vender");
          }}
        />
      )}
    </main>
  );
}
