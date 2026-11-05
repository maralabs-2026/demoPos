export type SectionTab = { href: string; label: string };

// La pestaña activa es la de la ruta más específica que coincide: /caja/gastos marca Gastos, y
// /caja/cerrar/... marca Caja.
export function activeTabHref(
  tabs: readonly SectionTab[],
  pathname: string,
): string | undefined {
  return tabs
    .filter(
      (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
