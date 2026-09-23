"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { loginSchema } from "../schemas";
import { findMockUsuario, type MockUsuario } from "../mock";

type LoginErrorCode = "invalid_credentials" | "too_many_attempts" | "user_disabled" | "network";

const loginErrorMessages: Record<LoginErrorCode, string> = {
  invalid_credentials: "Correo o contraseña incorrectos",
  too_many_attempts: "Demasiados intentos. Probá de nuevo en unos minutos.",
  user_disabled: "Tu usuario está desactivado. Contactá al administrador.",
  network: "No se pudo conectar. Verificá tu conexión y probá de nuevo.",
};

type AuthResult = { ok: true; usuario: MockUsuario } | { ok: false; code: LoginErrorCode };

function authenticateWithMock(email: string, password: string): AuthResult {
  const usuario = findMockUsuario(email);
  if (!usuario || usuario.password !== password) {
    return { ok: false, code: "invalid_credentials" };
  }
  return { ok: true, usuario };
}

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
      const result = authenticateWithMock(parsed.data.email, parsed.data.password);
      if (result.ok) {
        onSuccess?.(result.usuario);
      } else {
        setAuthError(result.code);
        setPassword("");
        passwordRef.current?.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClasses = cn(
    "h-[52px] w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring",
  );

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
        <input
          ref={emailRef}
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ejemplo@correo.com"
          aria-invalid={Boolean(fieldErrors.email)}
          className={cn(
            inputClasses,
            fieldErrors.email ? "border-destructive" : "border-border",
          )}
        />
        {fieldErrors.email && (
          <p className="text-destructive text-sm">{fieldErrors.email}</p>
        )}

        <label htmlFor="login-password" className="text-sm text-foreground">
          Contraseña
        </label>
        <input
          ref={passwordRef}
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          aria-invalid={Boolean(fieldErrors.password)}
          className={cn(
            inputClasses,
            fieldErrors.password ? "border-destructive" : "border-border",
          )}
        />
        {fieldErrors.password && (
          <p className="text-destructive text-sm">{fieldErrors.password}</p>
        )}

        {authError && (
          <p role="alert" className="text-destructive text-sm">
            {loginErrorMessages[authError]}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-primary text-sm font-medium tracking-wide text-primary-foreground uppercase transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}
