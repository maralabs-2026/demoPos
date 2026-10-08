// Mapping of Supabase Auth errors to the messages shown by the login form.
// Credentials problems always collapse into a single generic message so the
// form never reveals whether an email exists.

export type LoginErrorCode =
  | "invalid_credentials"
  | "too_many_attempts"
  | "user_disabled"
  | "network";

export const loginErrorMessages: Record<LoginErrorCode, string> = {
  invalid_credentials: "Correo o contraseña incorrectos",
  too_many_attempts: "Demasiados intentos. Probá de nuevo en unos minutos.",
  user_disabled: "Tu usuario está desactivado. Contactá al administrador.",
  network: "No se pudo conectar. Verificá tu conexión y probá de nuevo.",
};

interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

function toAuthErrorLike(error: unknown): AuthErrorLike {
  if (typeof error !== "object" || error === null) return {};
  const { status, code, message } = error as AuthErrorLike;
  return { status, code, message };
}

export function mapLoginError(error: unknown): LoginErrorCode {
  const { status, code, message } = toAuthErrorLike(error);
  const detail = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (
    status === 429 ||
    detail.includes("too many requests") ||
    detail.includes("rate limit")
  ) {
    return "too_many_attempts";
  }
  if (detail.includes("user is disabled")) {
    return "user_disabled";
  }
  if (
    status === 400 ||
    status === 401 ||
    status === 422 ||
    detail.includes("invalid login credentials") ||
    detail.includes("email not confirmed")
  ) {
    return "invalid_credentials";
  }
  return "network";
}
