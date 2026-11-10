import Link from "next/link";
import { History, Receipt, Truck, Wallet, type LucideIcon } from "lucide-react";
import { BotonMenu, canAccess, type AppRoute, type Rol } from "@/modules/auth";
import { cn } from "@/lib/utils";

type Acceso = {
  href: AppRoute;
  label: string;
  icon: LucideIcon;
  // Fondo del botón: colores de la paleta (chart-*), con texto blanco en todos.
  color: string;
};

const ACCESOS: readonly Acceso[] = [
  { href: "/caja", label: "Caja", icon: Wallet, color: "bg-foreground" },
  {
    href: "/reportes/ventas",
    label: "Historial",
    icon: History,
    color: "bg-chart-5",
  },
  { href: "/caja/gastos", label: "Gastos", icon: Receipt, color: "bg-chart-4" },
  {
    href: "/stock/proveedores",
    label: "Proveedores",
    icon: Truck,
    color: "bg-primary",
  },
];

// Accesos rápidos desde el mostrador, filtrados con los mismos permisos que la navegación.
export function AccesosVenta({ rol }: { rol: Rol }) {
  const accesos = ACCESOS.filter((a) => canAccess(rol, a.href));
  return (
    <nav
      aria-label="Accesos rápidos"
      className="hidden items-center gap-2 lg:flex"
    >
      {/* Sin barra lateral en el punto de venta: el resto de la app se abre desde acá. */}
      <BotonMenu className="shrink-0" />
      <ul className="grid flex-1 auto-cols-fr grid-flow-col gap-2">
        {accesos.map(({ href, label, icon: Icon, color }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                color,
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
              {href === "/caja" && (
                // Esta pantalla solo se ve con la caja abierta.
                <span className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-success-soft ring-2 ring-success"
                  />
                  <span className="sr-only">(abierta)</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
