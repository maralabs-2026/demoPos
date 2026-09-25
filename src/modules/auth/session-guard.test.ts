import { describe, expect, it } from "vitest";
import { mockUsuarios } from "./mock";
import { mustChangePassword } from "./session-guard";

describe("mustChangePassword", () => {
  it("bloquea una sesión con contraseña temporal pendiente", () => {
    const pending = mockUsuarios.find((usuario) => usuario.mustChangePassword);
    expect(pending).toBeDefined();
    expect(mustChangePassword(pending ?? null)).toBe(true);
  });

  it("permite una sesión con mustChangePassword=false", () => {
    const normal = mockUsuarios.find((usuario) => !usuario.mustChangePassword);
    expect(normal).toBeDefined();
    expect(mustChangePassword(normal ?? null)).toBe(false);
  });

  it("permite la ausencia de sesión (no bloquea a visitantes anónimos)", () => {
    expect(mustChangePassword(null)).toBe(false);
  });
});