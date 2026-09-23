// TODO(fase-2): reemplazar por Supabase Auth (semana 2)
// Mock users for the Phase 2 auth UI. Isolated test data; no Supabase calls.

export type Rol = "dueno" | "encargado" | "cajero";

export interface MockUsuario {
  email: string;
  password: string;
  rol: Rol;
  nombre: string;
  comercio: string;
  mustChangePassword: boolean;
}

export const mockUsuarios: MockUsuario[] = [
  {
    email: "admin@kioskodemo.com",
    password: "demo1234",
    rol: "dueno",
    nombre: "María López",
    comercio: "Kiosko Central - Sucursal 01",
    mustChangePassword: false,
  },
  {
    email: "encargado@kioskodemo.com",
    password: "demo1234",
    rol: "encargado",
    nombre: "Carlos Giménez",
    comercio: "Kiosko Central - Sucursal 01",
    mustChangePassword: false,
  },
  {
    email: "juan.perez@kioskodemo.com",
    password: "demo1234",
    rol: "cajero",
    nombre: "Juan Pérez",
    comercio: "Kiosko Central - Sucursal 01",
    mustChangePassword: true,
  },
];

export function findMockUsuario(email: string): MockUsuario | undefined {
  return mockUsuarios.find((usuario) => usuario.email === email.trim().toLowerCase());
}

const SESSION_STORAGE_KEY = "demo-pos:mock-session";

export function storeMockSession(usuario: MockUsuario): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(usuario));
}

export function getMockSession(): MockUsuario | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockUsuario;
  } catch {
    return null;
  }
}

export function updateMockPassword(
  email: string,
  newPassword: string,
): { ok: true; data: MockUsuario } | { ok: false; error: string } {
  const usuario = findMockUsuario(email);
  if (!usuario) {
    return { ok: false, error: "No se pudo actualizar la contraseña" };
  }
  usuario.password = newPassword;
  usuario.mustChangePassword = false;
  return { ok: true, data: usuario };
}
