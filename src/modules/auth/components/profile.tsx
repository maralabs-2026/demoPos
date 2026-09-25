"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, UserRound } from "lucide-react";
import { clearMockSession, getMockSession, type MockUsuario } from "@/modules/auth";
import type { Rol } from "@/modules/auth";

const rolValue: Record<Rol, string> = {
  dueno: "Dueño",
  encargado: "Encargado",
  cajero: "Cajero",
};

const rolChip: Record<Rol, string> = {
  dueno: "DUEÑO",
  encargado: "ENCARGADO",
  cajero: "CAJERO",
};

function initials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-0.5 rounded-xl bg-[#ECF4FF] px-4 py-2 md:flex-row md:items-center md:justify-between md:gap-4 md:rounded-lg md:bg-[#F7F9FF]">
      <span className="text-[11px] font-normal text-[#474556] md:font-semibold md:text-[13px]">
        {label}
      </span>
      {children}
    </div>
  );
}

export function Profile() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<MockUsuario | null>(null);

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
    <main className="mx-auto flex min-h-screen w-full max-w-[672px] flex-col px-4 py-3 md:px-6 md:py-10">
      <div className="flex flex-col gap-0.5 md:items-center md:gap-1">
        <h1 className="text-[26px] font-bold tracking-tight text-[#101D27] md:text-[32px]">
          Mi perfil
        </h1>
        <p className="text-[14px] text-[#474556]">
          Información de la cuenta
          <span className="hidden md:inline"> y sesión actual</span>
        </p>
      </div>

      <div className="mt-4 flex w-full flex-col gap-3 rounded-xl bg-background p-4 md:mt-6 md:gap-4 md:p-6">
        <div className="flex w-full items-center gap-4 rounded-lg bg-[#ECF4FF] p-4 md:rounded-md">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C8DFFE] text-[#4D627D] md:h-14 md:w-14 md:bg-[#533AFD] md:text-white">
            <UserRound size={26} className="md:hidden" />
            <span className="hidden text-lg font-semibold md:block">
              {initials(usuario.nombre)}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold text-[#101D27] md:text-lg">
              {usuario.nombre}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[#474556] md:text-xs">
              <span className="hidden h-2 w-2 rounded-full bg-[#533AFD] md:block" />
              Sesión activa
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-1.5 md:gap-4">
          <Field label="Nombre">
            <span className="text-base font-semibold text-[#101D27] md:font-medium">
              {usuario.nombre}
            </span>
          </Field>
          <Field label="Correo electrónico">
            <span className="truncate text-base font-semibold text-[#101D27] md:font-medium">
              {usuario.email}
            </span>
          </Field>
          <Field label="Rol asignado">
            <span className="text-base font-semibold text-[#101D27] md:hidden">
              {rolValue[usuario.rol]}
            </span>
            <span className="hidden rounded-lg bg-[#C8DFFE] px-2.5 py-1 text-[11px] font-semibold text-[#4D627D] md:inline-flex">
              {rolChip[usuario.rol]}
            </span>
          </Field>
          <Field label="Comercio">
            <span className="flex items-center gap-1 text-base font-semibold text-[#101D27] md:font-medium">
              <Building2 size={18} className="hidden text-[#4A607B] md:block" />
              {usuario.comercio}
            </span>
          </Field>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#533AFD] text-[15px] font-semibold text-white transition-colors hover:bg-[#533AFD]/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:mt-2"
        >
          <LogOut size={20} />
          Cerrar sesión
        </button>
      </div>

      <footer className="mt-auto hidden items-center justify-between border-t px-2 pt-4 md:flex">
        <span className="text-xs text-[#474556]">
          © {new Date().getFullYear()} {usuario.comercio}. Todos los derechos reservados.
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4A607B]">
          <span className="h-2 w-2 rounded-full bg-[#533AFD]" />
          Terminal Activa
        </span>
      </footer>
    </main>
  );
}
