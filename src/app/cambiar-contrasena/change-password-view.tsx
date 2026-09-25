"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";
import { findMockUsuario, getMockSession, storeMockSession } from "@/modules/auth";

export function ChangePasswordView() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);

  useEffect(() => {
    const session = getMockSession();
    if (session === null || !session.mustChangePassword) {
      router.replace("/login");
      return;
    }
    setEmail(session.email);
    const usuario = findMockUsuario(session.email);
    if (usuario) {
      setCurrentPassword(usuario.password);
    }
  }, [router]);

  return (
    <main className="flex min-h-dvh w-full flex-col p-6 md:items-center md:justify-center md:px-0 md:py-0">
      {email !== null && currentPassword !== null && (
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
