import { describe, expect, it } from "vitest";
import { buildSessionProfile, mustChangePasswordFromMetadata } from "./session";

describe("mustChangePasswordFromMetadata", () => {
  it("lee el flag cuando es exactamente true", () => {
    expect(mustChangePasswordFromMetadata({ must_change_password: true })).toBe(true);
  });

  it("trata ausencia, false, otro tipo o metadata no-objeto como false", () => {
    expect(mustChangePasswordFromMetadata({})).toBe(false);
    expect(mustChangePasswordFromMetadata({ must_change_password: false })).toBe(false);
    expect(mustChangePasswordFromMetadata({ must_change_password: "true" })).toBe(false);
    expect(mustChangePasswordFromMetadata(null)).toBe(false);
    expect(mustChangePasswordFromMetadata(undefined)).toBe(false);
  });
});

describe("buildSessionProfile", () => {
  const perfil = { rol: "cajero" as const, comercio_id: "com-1", nombre: "Juan Pérez" };

  it("arma el perfil con perfiles/comercios y la metadata del usuario", () => {
    const profile = buildSessionProfile(
      "cajero@kiosko.demo",
      { must_change_password: true },
      perfil,
      "Kiosko Demo",
    );

    expect(profile).toEqual({
      email: "cajero@kiosko.demo",
      rol: "cajero",
      comercio_id: "com-1",
      nombre: "Juan Pérez",
      comercio: "Kiosko Demo",
      must_change_password: true,
    });
  });

  it("normaliza email y comercio ausentes sin romper", () => {
    const profile = buildSessionProfile(null, {}, perfil, null);

    expect(profile.email).toBe("");
    expect(profile.comercio).toBe("");
    expect(profile.must_change_password).toBe(false);
  });
});
