import { AuthError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  loginErrorMessages,
  mapLoginError,
  mapPasswordChangeError,
} from "./login-error";

const GENERIC = "Correo o contraseña incorrectos";

describe("mapLoginError", () => {
  it("mapea a un único mensaje genérico la contraseña incorrecta y el correo inexistente", () => {
    const wrongPassword = mapLoginError(
      new AuthError("Invalid login credentials", 400),
    );
    const unknownEmail = mapLoginError(
      new AuthError("Invalid login credentials", 400),
    );

    expect(wrongPassword).toBe("invalid_credentials");
    expect(unknownEmail).toBe("invalid_credentials");
    expect(loginErrorMessages[wrongPassword]).toBe(GENERIC);
    expect(loginErrorMessages[unknownEmail]).toBe(
      loginErrorMessages[wrongPassword],
    );
  });

  it("traduce otros errores de credenciales de Supabase al mismo mensaje genérico", () => {
    expect(mapLoginError(new AuthError("Email not confirmed", 400))).toBe(
      "invalid_credentials",
    );
    expect(loginErrorMessages.invalid_credentials).toBe(GENERIC);
  });

  it("distingue demasiados intentos y usuario desactivado", () => {
    expect(mapLoginError(new AuthError("Too many requests", 429))).toBe(
      "too_many_attempts",
    );
    expect(mapLoginError(new AuthError("User is disabled", 403))).toBe(
      "user_disabled",
    );
  });

  it("trata los fallos de red o de servidor aparte de las credenciales", () => {
    expect(mapLoginError(new TypeError("Failed to fetch"))).toBe("network");
    expect(mapLoginError(new AuthError("Internal Server Error", 500))).toBe(
      "network",
    );
    expect(loginErrorMessages.network).not.toBe(GENERIC);
  });

  it("decide solo por el status cuando el mensaje no coincide por texto", () => {
    expect(mapLoginError(new AuthError("algo raro", 429))).toBe(
      "too_many_attempts",
    );
    expect(mapLoginError(new AuthError("algo raro", 401))).toBe(
      "invalid_credentials",
    );
    expect(mapLoginError(new AuthError("algo raro", 422))).toBe(
      "invalid_credentials",
    );
    expect(mapLoginError(new AuthError("algo raro", 500))).toBe("network");
  });
});

describe("mapPasswordChangeError", () => {
  it("explica la contraseña repetida, la débil y el exceso de intentos", () => {
    expect(
      mapPasswordChangeError(
        new AuthError(
          "New password should be different from the old password.",
          422,
          "same_password",
        ),
      ),
    ).toBe("La contraseña nueva debe ser distinta de la actual");
    expect(
      mapPasswordChangeError(
        new AuthError("Password is too weak", 422, "weak_password"),
      ),
    ).toBe("La contraseña es muy débil. Probá con una más larga.");
    expect(mapPasswordChangeError(new AuthError("algo raro", 429))).toBe(
      loginErrorMessages.too_many_attempts,
    );
  });
});
