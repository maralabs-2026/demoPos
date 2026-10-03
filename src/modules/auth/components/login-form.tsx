"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "../schemas";
import { loginErrorMessages, mapLoginError, type LoginErrorCode } from "../login-error";

export function LoginForm({
  onSuccess,
}: {
  onSuccess?: (result: { mustChangePassword: boolean }) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"email" | "password", string>>
  >({});
  const [authError, setAuthError] = useState<LoginErrorCode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Partial<Record<"email" | "password", string>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if ((key === "email" || key === "password") && !errors[key]) {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      setAuthError(null);
      return;
    }

    setFieldErrors({});
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        setAuthError(mapLoginError(error));
        setPassword("");
        passwordRef.current?.focus();
        return;
      }

      onSuccess?.({
        mustChangePassword: data.user.user_metadata.must_change_password === true,
      });
    } catch (error) {
      setAuthError(mapLoginError(error));
      setPassword("");
      passwordRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClasses =
    "h-[52px] w-full rounded-xl border-border bg-background px-4 py-0 text-base md:text-base placeholder:text-muted-foreground focus:border-ring aria-invalid:ring-0";

  return (
    <div className="w-full rounded-xl bg-background md:max-w-[420px] md:border md:border-border md:p-10">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5 md:gap-6">
        <h1 className="text-2xl font-normal tracking-tight text-foreground md:text-[28px]">
          Iniciar sesión
        </h1>

        <div aria-hidden className="h-3 md:h-2" />

        <label htmlFor="login-email" className="text-sm text-foreground">
          Correo electrónico
        </label>
        <Input
          ref={emailRef}
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ejemplo@correo.com"
          aria-invalid={Boolean(fieldErrors.email)}
          className={inputClasses}
        />
        {fieldErrors.email && (
          <p className="text-destructive text-sm">{fieldErrors.email}</p>
        )}

        <label htmlFor="login-password" className="text-sm text-foreground">
          Contraseña
        </label>
        <Input
          ref={passwordRef}
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          aria-invalid={Boolean(fieldErrors.password)}
          className={inputClasses}
        />
        {fieldErrors.password && (
          <p className="text-destructive text-sm">{fieldErrors.password}</p>
        )}

        {authError && (
          <p role="alert" className="text-destructive text-sm">
            {loginErrorMessages[authError]}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-[52px] w-full rounded-xl tracking-wide uppercase disabled:pointer-events-auto disabled:cursor-not-allowed"
        >
          Ingresar
        </Button>
      </form>
    </div>
  );
}
