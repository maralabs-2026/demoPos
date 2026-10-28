import {
  Boxes,
  ChartColumn,
  Package,
  Settings,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";
import type { Rol } from "./session";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const VENDER: NavLink = { href: "/vender", label: "Vender", icon: Store };
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
  "/vender": TODOS,
  "/productos": TODOS,
  "/stock": ["dueno", "encargado"],
  "/reportes": ["dueno", "encargado"],
  "/config": ["dueno"],
  "/perfil": TODOS,
} as const satisfies Record<string, readonly Rol[]>;

export type AppRoute = keyof typeof ROUTE_ROLES;

export function canAccess(rol: Rol, route: AppRoute): boolean {
  return (ROUTE_ROLES[route] as readonly Rol[]).includes(rol);
}

const LINKS: readonly NavLink[] = [
  VENDER,
  PRODUCTOS,
  STOCK,
  REPORTES,
  CONFIG,
  MI_PERFIL,
];

export function getNavLinks(rol: Rol): readonly NavLink[] {
  return LINKS.filter((link) => canAccess(rol, link.href as AppRoute));
}
