"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  clearMockSession,
  getMockSession,
  type MockSession,
} from "@/modules/auth";
import { ROL_LABELS, rolBadgeVariant } from "@/modules/auth";

function initials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-0.5 rounded-lg bg-muted px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <span className="text-[0.625rem] font-bold tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

export function Profile() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<MockSession | null>(null);

  useEffect(() => {
    const session = getMockSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUsuario(session);
  }, [router]);

  function handleLogout() {
    clearMockSession();
    router.replace("/login");
  }

  if (!usuario) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[672px] flex-col p-4 sm:p-6 lg:min-h-dvh lg:p-8">
      <div className="flex flex-col gap-0.5 md:items-center md:gap-1">
        <h1 className="text-3xl">Mi perfil</h1>
        <p className="text-[14px] text-muted-foreground">
          Información de la cuenta
          <span className="hidden md:inline"> y sesión actual</span>
        </p>
      </div>

      <div className="mt-5 flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:mt-6 md:gap-4 md:p-6">
        <div className="flex w-full items-center gap-4 rounded-xl bg-accent p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground md:size-14">
            <span className="text-base font-semibold md:text-lg">
              {initials(usuario.nombre)}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold text-foreground md:text-lg">
              {usuario.nombre}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground md:text-xs">
              <span className="h-2 w-2 rounded-full bg-success" />
              Sesión activa
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5 md:gap-4">
          <Field label="Nombre">
            <span className="text-base font-semibold text-foreground md:font-medium">
              {usuario.nombre}
            </span>
          </Field>
          <Field label="Correo electrónico">
            <span className="truncate text-base font-semibold text-foreground md:font-medium">
              {usuario.email}
            </span>
          </Field>
          <Field label="Rol asignado">
            <Badge
              variant={rolBadgeVariant(usuario.rol)}
              className="mt-1 md:mt-0"
            >
              {ROL_LABELS[usuario.rol]}
            </Badge>
          </Field>
          <Field label="Comercio">
            <span className="flex items-center gap-1 text-base font-semibold text-foreground md:font-medium">
              <Building2
                size={18}
                className="hidden text-muted-foreground md:block"
              />
              {usuario.comercio}
            </span>
          </Field>
        </div>

        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={handleLogout}
          className="mt-1 w-full md:mt-2"
        >
          <LogOut data-icon="inline-start" />
          Cerrar sesión
        </Button>
      </div>

      <footer className="mt-auto hidden items-center justify-between border-t px-2 pt-4 md:flex">
        <span className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {usuario.comercio}. Todos los derechos
          reservados.
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" />
          Terminal Activa
        </span>
      </footer>
    </main>
  );
}
