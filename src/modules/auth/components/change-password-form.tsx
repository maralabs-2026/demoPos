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
      const errors: Partial<Record<"newPassword" | "confirmPassword", string>> =
        {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (
          (key === "newPassword" || key === "confirmPassword") &&
          !errors[key]
        ) {
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

  const inputClasses = "h-12 pr-12 text-base md:text-base";

  return (
    <div className="w-full md:max-w-[440px] md:rounded-3xl md:border md:border-border md:bg-card md:p-10 md:shadow-[0_30px_70px_rgba(34,42,38,0.08)]">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl">Cambiar contraseña</h1>
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
          <label
            htmlFor="change-password-new"
            className="text-sm font-semibold"
          >
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
              {showNew ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </Button>
          </div>
          {fieldErrors.newPassword && (
            <p className="text-sm text-destructive">
              {fieldErrors.newPassword}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="change-password-confirm"
            className="text-sm font-semibold"
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
              aria-label={
                showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 p-0 text-muted-foreground hover:bg-transparent hover:text-muted-foreground active:translate-y-0"
            >
              {showConfirm ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </Button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="text-sm text-destructive">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
          >
            {formError}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          size="lg"
          className="mt-2 w-full disabled:pointer-events-auto disabled:cursor-not-allowed"
        >
          Cambiar contraseña
        </Button>
      </form>
    </div>
  );
}
