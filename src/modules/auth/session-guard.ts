import type { SessionProfile } from "./session";

export function mustChangePassword(profile: SessionProfile | null): boolean {
  return profile !== null && profile.must_change_password;
}
