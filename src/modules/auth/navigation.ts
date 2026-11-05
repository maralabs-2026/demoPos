import {
  Boxes,
  ChartColumn,
  LayoutDashboard,
  Package,
  Settings,
  Store,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Rol } from "./session";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const INICIO: NavLink = {
  href: "/inicio",
  label: "Inicio",
  icon: LayoutDashboard,
};
const VENDER: NavLink = { href: "/vender", label: "Vender", icon: Store };
const CAJA: NavLink = { href: "/caja", label: "Caja", icon: Wallet };
const PRODUCTOS: NavLink = {
  href: "/productos",
  label: "Productos",
  icon: Package,
};
const STOCK: NavLink = { href: "/stock", label: "Stock", icon: Boxes };
const REPORTES: NavLink = {
  href: "/reportes",
  label: "Reportes",
  icon: ChartColumn,
};
const CONFIG: NavLink = { href: "/config", label: "Config", icon: Settings };
const MI_PERFIL: NavLink = { href: "/perfil", label: "Mi perfil", icon: User };

const TODOS: readonly Rol[] = ["dueno", "encargado", "cajero"];

// Única fuente de permisos por ruta: la usan la navegación y el guard del servidor (requireRol).
// Encargado: todo menos configuración (sección 3 de CLAUDE.md). Cajero: sin reportes ni config.
export const ROUTE_ROLES = {
  "/inicio": ["dueno", "encargado"],
  "/vender": TODOS,
  "/caja": TODOS,
  "/caja/historial": TODOS,
  "/caja/cerrar": ["dueno", "encargado"],
  "/caja/gastos": ["dueno", "encargado"],
  "/productos": TODOS,
  "/productos/precios": ["dueno", "encargado"],
  "/productos/importar": ["dueno", "encargado"],
  "/promociones": ["dueno", "encargado"],
  "/stock": ["dueno", "encargado"],
  "/stock/reposicion": ["dueno", "encargado"],
  "/stock/auditoria": ["dueno", "encargado"],
  "/reportes": ["dueno", "encargado"],
  "/reportes/ventas": ["dueno", "encargado"],
  "/config": ["dueno"],
  "/perfil": TODOS,
} as const satisfies Record<string, readonly Rol[]>;

export type AppRoute = keyof typeof ROUTE_ROLES;

export function canAccess(rol: Rol, route: AppRoute): boolean {
  return (ROUTE_ROLES[route] as readonly Rol[]).includes(rol);
}

const LINKS: readonly NavLink[] = [
  INICIO,
  VENDER,
  CAJA,
  PRODUCTOS,
  STOCK,
  REPORTES,
  CONFIG,
  MI_PERFIL,
];

export function getNavLinks(rol: Rol): readonly NavLink[] {
  return LINKS.filter((link) => canAccess(rol, link.href as AppRoute));
}

// La barra del celular tiene lugar para cinco. Si no entran todos, los primeros cuatro y "Más".
const BARRA_MAX = 5;

export function getMobileNav(rol: Rol): {
  barra: readonly NavLink[];
  mas: readonly NavLink[];
} {
  const links = getNavLinks(rol);
  if (links.length <= BARRA_MAX) return { barra: links, mas: [] };
  return {
    barra: links.slice(0, BARRA_MAX - 1),
    mas: links.slice(BARRA_MAX - 1),
  };
}
