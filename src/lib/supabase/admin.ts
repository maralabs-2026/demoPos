import { createClient } from "@supabase/supabase-js";

// Cliente con la service role key: saltea la RLS. Solo para acciones del servidor que el usuario
// no puede hacer por sí mismo (por ejemplo, limpiar app_metadata.must_change_password).
// La key no lleva el prefijo NEXT_PUBLIC_, así que Next nunca la incluye en el bundle del navegador;
// el chequeo de window es una segunda barrera si alguien lo importa desde un componente cliente.
export function isAdminConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient solo puede usarse en el servidor");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
