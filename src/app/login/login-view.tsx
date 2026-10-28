"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/modules/auth/components/login-form";

export function LoginView({ safeNext }: { safeNext: string }) {
  const router = useRouter();

  return (
    <main className="flex min-h-dvh w-full flex-col px-6 pt-[88px] pb-24 md:items-center md:justify-center md:px-0 md:py-0">
      <LoginForm
        onSuccess={({ mustChangePassword }) => {
          router.refresh();
          router.push(mustChangePassword ? "/cambiar-contrasena" : safeNext);
        }}
      />
    </main>
  );
}
