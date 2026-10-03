import { AuthError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loginErrorMessages, mapLoginError } from "./login-error";

const GENERIC = "Correo o contraseña incorrectos";

describe("mapLoginError", () => {
  it("mapea a un único mensaje genérico la contraseña incorrecta y el correo inexistente", () => {
    const wrongPassword = mapLoginError(
      new AuthError("Invalid login credentials", { status: 400 }),
    );
    const unknownEmail = mapLoginError(
      new AuthError("Invalid login credentials", { status: 400 }),
    );

    expect(wrongPassword).toBe("invalid_credentials");
    expect(unknownEmail).toBe("invalid_credentials");
    expect(loginErrorMessages[wrongPassword]).toBe(GENERIC);
    expect(loginErrorMessages[unknownEmail]).toBe(loginErrorMessages[wrongPassword]);
  });

  it("traduce otros errores de credenciales de Supabase al mismo mensaje genérico", () => {
    expect(mapLoginError(new AuthError("Email not confirmed", { status: 400 }))).toBe(
      "invalid_credentials",
    );
    expect(loginErrorMessages.invalid_credentials).toBe(GENERIC);
  });

  it("distingue demasiados intentos y usuario desactivado", () => {
    expect(mapLoginError(new AuthError("Too many requests", { status: 429 }))).toBe(
      "too_many_attempts",
    );
    expect(mapLoginError(new AuthError("User is disabled", { status: 403 }))).toBe(
      "user_disabled",
    );
  });

  it("trata los fallos de red o de servidor aparte de las credenciales", () => {
    expect(mapLoginError(new TypeError("Failed to fetch"))).toBe("network");
    expect(mapLoginError(new AuthError("Internal Server Error", { status: 500 }))).toBe(
      "network",
    );
    expect(loginErrorMessages.network).not.toBe(GENERIC);
  });
});
