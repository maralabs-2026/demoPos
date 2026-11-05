import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "El correo es obligatorio")
  .max(254, "El correo no puede superar los 254 caracteres")
  .pipe(z.email("Ingresá un correo válido"));

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, "La contraseña es obligatoria")
    .max(128, "La contraseña no puede superar los 128 caracteres"),
});

export const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(128, "La contraseña no puede superar los 128 caracteres"),
    confirmPassword: z
      .string()
      .min(1, "La contraseña es obligatoria")
      .max(128, "La contraseña no puede superar los 128 caracteres"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const NOMBRE_USUARIO_MAX = 80;

const nombreUsuario = z
  .string({ error: "Escribí el nombre" })
  .trim()
  .min(1, "Escribí el nombre")
  .max(
    NOMBRE_USUARIO_MAX,
    `El nombre puede tener hasta ${NOMBRE_USUARIO_MAX} caracteres`,
  );

const rolUsuario = z.enum(["dueno", "encargado", "cajero"], {
  error: "Elegí un rol",
});

const contrasenaTemporal = z
  .string({ error: "Escribí la contraseña temporal" })
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña no puede superar los 128 caracteres");

export const crearUsuarioSchema = z.object({
  nombre: nombreUsuario,
  email: emailField,
  rol: rolUsuario,
  contrasena: contrasenaTemporal,
});

export const editarUsuarioSchema = z.object({
  usuarioId: z.uuid({ error: "El usuario no es válido" }),
  nombre: nombreUsuario,
  rol: rolUsuario,
});

export const blanquearContrasenaSchema = z.object({
  usuarioId: z.uuid({ error: "El usuario no es válido" }),
  contrasena: contrasenaTemporal,
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;
export type BlanquearContrasenaInput = z.infer<
  typeof blanquearContrasenaSchema
>;
