// "/" deriva según el rol (ver src/app/(app)/page.tsx).
export const DEFAULT_NEXT = "/";

export function getNextRoute(next: unknown): string {
  if (typeof next !== "string") return DEFAULT_NEXT;
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_NEXT;
  return next;
}
