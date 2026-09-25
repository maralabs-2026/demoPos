"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/modules/auth/components/login-form";
import { storeMockSession } from "@/modules/auth";

export function LoginView({ safeNext }: { safeNext: string }) {
  const router = useRouter();

  return (
    <main className="flex min-h-dvh w-full flex-col px-6 pb-24 pt-[88px] md:items-center md:justify-center md:px-0 md:py-0">
      <LoginForm
        onSuccess={(usuario) => {
          storeMockSession(usuario);
          if (usuario.mustChangePassword) {
            router.push("/cambiar-contrasena");
          } else {
            router.push(safeNext);
          }
        }}
      />
    </main>
  );
}
