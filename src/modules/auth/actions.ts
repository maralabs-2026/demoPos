"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mapPasswordChangeError } from "./login-error";
import { getAuthProfile } from "./queries";
import {
  blanquearContrasenaSchema,
  changePasswordSchema,
  crearUsuarioSchema,
  editarUsuarioSchema,
  type BlanquearContrasenaInput,
  type ChangePasswordInput,
  type CrearUsuarioInput,
  type EditarUsuarioInput,
} from "./schemas";

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

// Sin vencimiento práctico: un usuario desactivado no ingresa hasta que se lo reactive.
const BLOQUEO_INGRESO = "876000h";

const SIN_PERMISO = "No tenés permiso para modificar este usuario.";

// Lo que se hace con la service role saltea la RLS: antes se pregunta a la base si corresponde.
async function puedeAdministrar(usuarioId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("puede_administrar_usuario", {
    p_usuario_id: usuarioId,
  });
  return !error && data === true;
}

// El usuario de Auth se crea con la service role y el perfil con la sesión de quien crea: la RLS
// decide si puede darle ese rol. Si el perfil falla, se borra el usuario para no dejarlo a medias.
export async function crearUsuario(
  input: CrearUsuarioInput,
): Promise<ActionResult<null>> {
  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    return fail("Falta configurar Supabase en el servidor.");
  }

  const profile = await getAuthProfile();
  if (!profile) return fail("Tu sesión venció. Volvé a ingresar.");
  if (
    profile.rol !== "dueno" &&
    !(profile.rol === "encargado" && parsed.data.rol === "cajero")
  ) {
    return fail("No tenés permiso para crear un usuario con ese rol.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.contrasena,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists") {
      return fail("Ese correo no se puede usar. Probá con otro.");
    }
    return fail(
      error?.code === "weak_password"
        ? "La contraseña es muy débil. Probá con una más larga."
        : "No se pudo crear el usuario. Probá de nuevo.",
    );
  }

  const supabase = await createClient();
  const { error: perfilError } = await supabase.from("perfiles").insert({
    id: data.user.id,
    comercio_id: profile.comercio_id,
    rol: parsed.data.rol,
    nombre: parsed.data.nombre,
  });
  if (perfilError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return fail("No se pudo crear el usuario. Probá de nuevo.");
  }

  revalidatePath("/usuarios");
  return ok(null);
}

export async function editarUsuario(
  input: EditarUsuarioInput,
): Promise<ActionResult<null>> {
  const parsed = editarUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en el servidor.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .update({ nombre: parsed.data.nombre, rol: parsed.data.rol })
    .eq("id", parsed.data.usuarioId)
    .select("id");

  if (error?.code === "42501") return fail(SIN_PERMISO);
  if (error) return fail("No se pudo guardar el usuario. Probá de nuevo.");
  // La RLS no da error por las filas que no deja tocar: simplemente no las actualiza.
  if (data.length === 0) return fail(SIN_PERMISO);

  revalidatePath("/usuarios");
  return ok(null);
}

// Desactivar marca el perfil, que corta el acceso a los datos, y bloquea el ingreso. Si lo segundo
// falla, se revierte lo primero: un usuario no queda con un estado a medias.
export async function cambiarActivoUsuario(
  usuarioId: string,
  activo: boolean,
): Promise<ActionResult<null>> {
  const parsedId = editarUsuarioSchema.shape.usuarioId.safeParse(usuarioId);
  if (!parsedId.success) return fail("El usuario no es válido");
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    return fail("Falta configurar Supabase en el servidor.");
  }
  if (!(await puedeAdministrar(parsedId.data))) return fail(SIN_PERMISO);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .update({ activo })
    .eq("id", parsedId.data)
    .select("id");
  if (error || data.length === 0) {
    return fail("No se pudo cambiar el usuario. Probá de nuevo.");
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(
    parsedId.data,
    { ban_duration: activo ? "none" : BLOQUEO_INGRESO },
  );
  if (authError) {
    await supabase
      .from("perfiles")
      .update({ activo: !activo })
      .eq("id", parsedId.data);
    return fail("No se pudo cambiar el usuario. Probá de nuevo.");
  }

  revalidatePath("/usuarios");
  return ok(null);
}

// Define una contraseña temporal: el usuario tiene que cambiarla en su próximo ingreso.
export async function blanquearContrasena(
  input: BlanquearContrasenaInput,
): Promise<ActionResult<null>> {
  const parsed = blanquearContrasenaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    return fail("Falta configurar Supabase en el servidor.");
  }
  if (!(await puedeAdministrar(parsed.data.usuarioId))) {
    return fail(SIN_PERMISO);
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(
    parsed.data.usuarioId,
    {
      password: parsed.data.contrasena,
      app_metadata: { must_change_password: true },
    },
  );
  if (error) return fail(mapPasswordChangeError(error));

  revalidatePath("/usuarios");
  return ok(null);
}
