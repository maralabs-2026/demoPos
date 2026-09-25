import { ChartColumn, Package, Settings, Store, User, type LucideIcon } from "lucide-react";
import type { Rol } from "./mock";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const VENDER: NavLink = { href: "/vender", label: "Vender", icon: Store };
const PRODUCTOS: NavLink = { href: "/productos", label: "Productos", icon: Package };
const REPORTES: NavLink = { href: "/reportes", label: "Reportes", icon: ChartColumn };
const CONFIG: NavLink = { href: "/config", label: "Config", icon: Settings };
const MI_PERFIL: NavLink = { href: "/perfil", label: "Mi perfil", icon: User };

export const NAV_LINKS: Record<Rol, readonly NavLink[]> = {
  dueno: [VENDER, PRODUCTOS, REPORTES, CONFIG, MI_PERFIL],
  encargado: [VENDER, PRODUCTOS, MI_PERFIL],
  cajero: [VENDER, PRODUCTOS, MI_PERFIL],
};

export function getNavLinks(rol: Rol): readonly NavLink[] {
  return NAV_LINKS[rol];
}
