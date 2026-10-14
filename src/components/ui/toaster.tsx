"use client";

import type { ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { cn } from "cn";
import { Check, Info, TriangleAlert, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

const toastManager = Toast.createToastManager();

function add(type: ToastType, title: string, description?: ReactNode) {
  return toastManager.add({
    type,
    title,
    description,
    // Los errores se anuncian con urgencia y duran más en pantalla.
    priority: type === "error" ? "high" : "low",
    timeout: type === "error" ? 7000 : 4000,
  });
}

/**
 * Avisos desde cualquier lugar de la app, incluso fuera de componentes:
 * `toast.success("Venta registrada", "Total $ 8.050,00")`.
 */
const toast = {
  success: (title: string, description?: ReactNode) =>
    add("success", title, description),
  error: (title: string, description?: ReactNode) =>
    add("error", title, description),
  info: (title: string, description?: ReactNode) =>
    add("info", title, description),
  close: (id: string) => toastManager.close(id),
};

const iconByType: Record<ToastType, ReactNode> = {
  success: <Check aria-hidden="true" />,
  error: <TriangleAlert aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
};

const iconClassByType: Record<ToastType, string> = {
  success: "bg-success text-success-foreground",
  error: "bg-destructive-soft text-destructive",
  info: "bg-accent text-accent-foreground",
};

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => {
    const type = (t.type as ToastType | undefined) ?? "info";
    return (
      <Toast.Root
        key={t.id}
        toast={t}
        className={cn(
          // Pila: el más nuevo adelante; al pasar el mouse o enfocar, se despliegan.
          "[--gap:0.75rem] [--peek:0.6rem] [--scale:calc(max(0,1-(var(--toast-index)*0.08)))] [--shrink:calc(1-var(--scale))] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))]",
          "absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] h-[var(--height)] w-full origin-bottom rounded-2xl border border-border bg-card text-card-foreground shadow-[0_18px_50px_rgba(20,25,21,0.18)] select-none",
          "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_0.45s_cubic-bezier(0.22,1,0.36,1),opacity_0.45s,height_0.15s]",
          "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
          "data-expanded:h-[var(--toast-height)] data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))]",
          "data-starting-style:[transform:translateY(150%)] data-ending-style:opacity-0 data-limited:opacity-0 [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
          "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        )}
      >
        <Toast.Content className="flex items-center gap-3 overflow-hidden p-3 transition-opacity duration-250 data-behind:opacity-0 data-expanded:opacity-100">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-4",
              iconClassByType[type],
            )}
          >
            {iconByType[type]}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <Toast.Title className="text-sm font-semibold" />
            <Toast.Description className="text-xs text-muted-foreground" />
          </div>
          <Toast.Close
            aria-label="Cerrar aviso"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-4" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}

/** Se monta una vez en el layout raíz. */
function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} limit={3}>
      <Toast.Portal>
        <Toast.Viewport className="fixed top-auto right-4 bottom-20 z-[55] mx-auto w-[calc(100vw-2rem)] sm:right-6 sm:w-90 lg:bottom-6">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

export { Toaster, toast };
