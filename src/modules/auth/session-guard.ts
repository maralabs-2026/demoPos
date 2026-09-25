import type { MockSession } from "./mock";

export function mustChangePassword(session: MockSession | null): boolean {
  return session !== null && session.mustChangePassword;
}