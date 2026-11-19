"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { borrarPaginasGuardadas } from "@/lib/service-worker";

// Cierra la sesión y borra las pantallas guardadas para usar sin conexión. Lo usan el perfil y
// el pie del menú lateral.
export function useCerrarSesion(): () => Promise<void> {
  const router = useRouter();
  return async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await borrarPaginasGuardadas();
    router.replace("/login");
    router.refresh();
  };
}

// "Ana María López" → "AL".
export function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
