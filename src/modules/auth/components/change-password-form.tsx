"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordSchema } from "../schemas";
import { updateMockPassword, type MockSession } from "../mock";

export function ChangePasswordForm({
  email,
  currentPassword,
  onSuccess,
}: {
  email: string;
  currentPassword: string;
  onSuccess?: (session: MockSession) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"newPassword" | "confirmPassword", string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      const errors: Partial<Record<"newPassword" | "confirmPassword", string>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if ((key === "newPassword" || key === "confirmPassword") && !errors[key]) {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = updateMockPassword(email, parsed.data.newPassword);
      if (result.ok) {
        onSuccess?.(result.data);
      } else {
        setFormError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClasses =
    "h-[48px] w-full rounded-xl border-border bg-background pl-4 pr-12 py-0 text-base md:text-base shadow-[0_1px_2px_rgba(13,37,61,0.05)] placeholder:text-muted-foreground focus:border-ring aria-invalid:ring-0";

  return (
    <div className="w-full rounded-xl bg-background p-5 shadow-[0_4px_24px_rgba(13,37,61,0.04)] md:max-w-[440px] md:p-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-normal tracking-tight text-foreground md:text-[28px]">
          Cambiar contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Debés cambiar tu contraseña temporal antes de continuar.
        </p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-5 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="change-password-new" className="text-[13px] text-foreground">
            Nueva contraseña
          </label>
          <div className="relative">
            <Input
              id="change-password-new"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.newPassword)}
              className={inputClasses}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 p-0 text-muted-foreground hover:bg-transparent hover:text-muted-foreground active:translate-y-0"
            >
              {showNew ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </Button>
          </div>
          {fieldErrors.newPassword && (
            <p className="text-destructive text-sm">{fieldErrors.newPassword}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="change-password-confirm"
            className="text-[13px] text-foreground"
          >
            Confirmar contraseña
          </label>
          <div className="relative">
            <Input
              id="change-password-confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              className={inputClasses}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 p-0 text-muted-foreground hover:bg-transparent hover:text-muted-foreground active:translate-y-0"
            >
              {showConfirm ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </Button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="text-destructive text-sm">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 h-[48px] w-full rounded-xl text-[15px] uppercase tracking-wide disabled:pointer-events-auto disabled:cursor-not-allowed"
        >
          Cambiar contraseña
        </Button>
      </form>
    </div>
  );
}
