import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
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
      .min(1, "La contraseña es obligatoria")
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
