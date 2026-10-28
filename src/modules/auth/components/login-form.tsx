"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "../schemas";
import {
  loginErrorMessages,
  mapLoginError,
  type LoginErrorCode,
} from "../login-error";

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
        mustChangePassword:
          data.user.app_metadata.must_change_password === true,
      });
    } catch (error) {
      setAuthError(mapLoginError(error));
      setPassword("");
      passwordRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClasses = "h-12 text-base md:text-base";

  return (
    <div className="w-full md:max-w-[420px] md:rounded-3xl md:border md:border-border md:bg-card md:p-10 md:shadow-[0_30px_70px_rgba(34,42,38,0.08)]">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h1 className="text-3xl md:text-4xl">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">
          Ingresá con tu correo y contraseña.
        </p>

        <div aria-hidden className="h-3" />

        <label htmlFor="login-email" className="text-sm font-semibold">
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
          <p className="text-sm text-destructive">{fieldErrors.email}</p>
        )}

        <label htmlFor="login-password" className="mt-2 text-sm font-semibold">
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
          <p className="text-sm text-destructive">{fieldErrors.password}</p>
        )}

        {authError && (
          <p
            role="alert"
            className="mt-2 rounded-lg bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
          >
            {loginErrorMessages[authError]}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="mt-4 w-full disabled:pointer-events-auto disabled:cursor-not-allowed"
        >
          Ingresar
        </Button>
      </form>
    </div>
  );
}
