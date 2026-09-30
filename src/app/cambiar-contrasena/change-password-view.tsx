"use client";

import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";

export function ChangePasswordView() {
  const router = useRouter();

  return (
    <main className="flex min-h-dvh w-full flex-col p-6 md:items-center md:justify-center md:px-0 md:py-0">
      <ChangePasswordForm
        onSuccess={() => {
          router.refresh();
          router.replace("/vender");
        }}
      />
    </main>
  );
}
