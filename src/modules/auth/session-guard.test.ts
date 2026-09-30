import { describe, expect, it } from "vitest";
import type { SessionProfile } from "./session";
import { mustChangePassword } from "./session-guard";

function makeProfile(overrides: Partial<SessionProfile> = {}): SessionProfile {
  return {
    email: "cajero@kiosko.demo",
    rol: "cajero",
    comercio_id: "11111111-1111-1111-1111-111111111111",
    nombre: "Juan Pérez",
    comercio: "Kiosko Demo",
    must_change_password: false,
    ...overrides,
  };
}

describe("mustChangePassword", () => {
  it("bloquea una sesión con contraseña temporal pendiente", () => {
    expect(mustChangePassword(makeProfile({ must_change_password: true }))).toBe(true);
  });

  it("permite una sesión con must_change_password=false", () => {
    expect(mustChangePassword(makeProfile())).toBe(false);
  });

  it("permite la ausencia de sesión (no bloquea a visitantes anónimos)", () => {
    expect(mustChangePassword(null)).toBe(false);
  });
});
