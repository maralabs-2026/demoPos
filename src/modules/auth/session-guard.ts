import type { MockUsuario } from "./mock";

export function mustChangePassword(session: MockUsuario | null): boolean {
  return session !== null && session.mustChangePassword;
}