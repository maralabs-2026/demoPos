import { describe, expect, it } from "vitest";
import { activeTabHref } from "./section-tabs";

const TABS = [
  { href: "/caja", label: "Caja" },
  { href: "/caja/gastos", label: "Gastos" },
  { href: "/caja/historial", label: "Historial" },
];

describe("activeTabHref", () => {
  it.each([
    ["/caja", "/caja"],
    ["/caja/cerrar/123", "/caja"],
    ["/caja/gastos", "/caja/gastos"],
    ["/caja/historial/123", "/caja/historial"],
    ["/cajas", undefined],
  ])("en %s marca %s", (pathname, esperado) => {
    expect(activeTabHref(TABS, pathname)).toBe(esperado);
  });
});
