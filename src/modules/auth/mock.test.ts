import { beforeEach, describe, expect, it } from "vitest";
import {
  authenticateWithMock,
  clearMockSession,
  findMockUsuario,
  getMockSession,
  mockUsuarios,
  storeMockSession,
  updateMockPassword,
  type MockSession,
  type MockUsuario,
} from "./mock";
import { mustChangePassword } from "./session-guard";
import { changePasswordSchema } from "./schemas";

class MemoryStorage {
  private items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }
}

function readSessionStorage(): string | null {
  const windowRef = globalThis.window as
    | { sessionStorage: MemoryStorage }
    | undefined;
  return windowRef?.sessionStorage.getItem("demo-pos:mock-session") ?? null;
}

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: new MemoryStorage() },
  });
});

describe("mock session store", () => {
  it("storeMockSession no persiste la contraseña", () => {
    const juan = findMockUsuario("juan.perez@kioskodemo.com");
    expect(juan).toBeDefined();
    storeMockSession(juan!);

    const raw = readSessionStorage();
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("password");
    expect(raw).not.toContain(juan!.password);

    const stored = JSON.parse(raw!) as MockUsuario;
    expect("password" in stored).toBe(false);
    expect(stored).toEqual({
      email: juan!.email,
      rol: juan!.rol,
      nombre: juan!.nombre,
      comercio: juan!.comercio,
      mustChangePassword: juan!.mustChangePassword,
    });
  });

  it("getMockSession no expone la contraseña", () => {
    const juan = findMockUsuario("juan.perez@kioskodemo.com");
    storeMockSession(juan!);

    const session = getMockSession();
    expect(session).not.toBeNull();
    expect(session!.email).toBe(juan!.email);
    expect(session!.rol).toBe("cajero");
    expect("password" in (session as MockSession & { password?: string })).toBe(false);
  });

  it("mustChangePassword sigue disponible para una sesion", () => {
    const pending = findMockUsuario("juan.perez@kioskodemo.com");
    const normal = findMockUsuario("admin@kioskodemo.com");
    expect(mustChangePassword(pending!)).toBe(true);
    expect(mustChangePassword(normal!)).toBe(false);
    expect(mustChangePassword(null)).toBe(false);
  });

  it("una sesión con email vacío no se trata como ausencia de sesión", () => {
    const emptyEmailSession: MockSession = {
      email: "",
      rol: "cajero",
      nombre: "",
      comercio: "",
      mustChangePassword: true,
    };

    storeMockSession(emptyEmailSession);
    const session = getMockSession();
    expect(session).not.toBeNull();
    expect(session!.email).toBe("");
    expect(mustChangePassword(session)).toBe(true);
  });

  it("una contraseña nueva igual a la temporal se rechaza (schema)", () => {
    const juan = findMockUsuario("juan.perez@kioskodemo.com");
    const current = juan!.password;
    expect(mustChangePassword(juan!)).toBe(true);

    const result = changePasswordSchema.safeParse({
      currentPassword: current,
      newPassword: current,
      confirmPassword: current,
    });
    expect(result.success).toBe(false);
  });

  it("una contraseña nueva válida y distinta supera el schema", () => {
    const juan = findMockUsuario("juan.perez@kioskodemo.com");
    const current = juan!.password;

    const result = changePasswordSchema.safeParse({
      currentPassword: current,
      newPassword: "nuevaclave1",
      confirmPassword: "nuevaclave1",
    });
    expect(result.success).toBe(true);
  });

  it("updateMockPassword devuelve sesion sin contraseña y la nueva queda en el mock", () => {
    const juan = findMockUsuario("juan.perez@kioskodemo.com");
    expect(juan!.mustChangePassword).toBe(true);

    const result = updateMockPassword(juan!.email, "nuevaclave1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect("password" in (result.data as MockSession & { password?: string })).toBe(false);
    expect(result.data.mustChangePassword).toBe(false);

    const updated = findMockUsuario(juan!.email);
    expect(updated!.password).toBe("nuevaclave1");
  });
});

describe("authenticateWithMock", () => {
  it("devuelve ok true con data en credenciales válidas", () => {
    const result = authenticateWithMock("admin@kioskodemo.com", "demo1234");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.email).toBe("admin@kioskodemo.com");
    expect(result.data.rol).toBe("dueno");
  });

  it("ignora mayúsculas y espacios en el correo pero no en la contraseña", () => {
    const okUser = authenticateWithMock("  ADMIN@KioskoDemo.com ", "demo1234");
    expect(okUser.ok).toBe(true);

    const badPass = authenticateWithMock("admin@kioskodemo.com", "DEMO1234");
    expect(badPass.ok).toBe(false);
  });

  it("devuelve ok false con error genérico en credenciales inválidas", () => {
    const result = authenticateWithMock("admin@kioskodemo.com", "incorrecta");
    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
  });

  it("devuelve ok false con error genérico para un correo inexistente", () => {
    const result = authenticateWithMock("nadie@kioskodemo.com", "demo1234");
    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
  });
});

describe("sesion persistida puede re-leerse", () => {
  it("clearMockSession borra la sesión", () => {
    storeMockSession(mockUsuarios[0]);
    expect(readSessionStorage()).not.toBeNull();
    clearMockSession();
    expect(readSessionStorage()).toBeNull();
  });
});