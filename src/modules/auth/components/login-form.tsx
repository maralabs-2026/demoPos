"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema } from "../schemas";
import {
  authenticateWithMock,
  type LoginErrorCode,
  type MockUsuario,
} from "../mock";

const loginErrorMessages: Record<LoginErrorCode, string> = {
  invalid_credentials: "Correo o contraseña incorrectos",
  too_many_attempts: "Demasiados intentos. Probá de nuevo en unos minutos.",
  user_disabled: "Tu usuario está desactivado. Contactá al administrador.",
  network: "No se pudo conectar. Verificá tu conexión y probá de nuevo.",
};

export function LoginForm({
  onSuccess,
}: {
  onSuccess?: (usuario: MockUsuario) => void;
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
      const result = authenticateWithMock(
        parsed.data.email,
        parsed.data.password,
      );
      if (result.ok) {
        onSuccess?.(result.data);
      } else {
        setAuthError(result.error);
        setPassword("");
        passwordRef.current?.focus();
      }
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
