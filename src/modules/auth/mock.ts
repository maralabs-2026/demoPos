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
