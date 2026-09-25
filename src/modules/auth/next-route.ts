export const DEFAULT_NEXT = "/vender";

export function getNextRoute(next: unknown): string {
  if (typeof next !== "string") return DEFAULT_NEXT;
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_NEXT;
  return next;
}
