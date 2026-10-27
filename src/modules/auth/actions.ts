"use server";

import { fail, ok, type ActionResult } from "@/lib/result";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mapPasswordChangeError } from "./login-error";
import { changePasswordSchema, type ChangePasswordInput } from "./schemas";

// Cambia la contraseña y limpia el indicador de contraseña temporal en una sola llamada.
// El indicador vive en app_metadata, que solo se escribe con la service role: así el usuario no
// puede saltear el cambio obligatorio escribiendo su propia metadata desde el navegador.
export async function cambiarContrasena(
  input: ChangePasswordInput,
): Promise<ActionResult<null>> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    return fail("Falta configurar Supabase en el servidor.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Volvé a ingresar.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data.newPassword,
    app_metadata: { must_change_password: false },
  });
  if (error) return fail(mapPasswordChangeError(error));

  // Cambiar la contraseña con la API admin revoca las sesiones del usuario. Se vuelve a iniciar
  // sesión acá, con la nueva, para que las cookies queden con un token sin el indicador.
  if (user.email) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.newPassword,
    });
    if (loginError) {
      return fail("Tu contraseña se cambió. Ingresá de nuevo con la nueva.");
    }
  }

  return ok(null);
}
