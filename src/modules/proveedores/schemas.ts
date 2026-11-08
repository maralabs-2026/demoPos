import { z } from "zod";

export const PROVEEDOR_NOMBRE_MAX = 120;
export const PROVEEDOR_NOTA_MAX = 300;

// Solo dígitos y con código de país, para armar el enlace de WhatsApp. Vacío = sin teléfono.
const telefonoSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || /^[0-9]{10,15}$/.test(v), {
    error: "Escribí el teléfono con código de país, por ejemplo 5493511234567",
  })
  .transform((v) => (v === "" ? null : v));

export const proveedorSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { error: "Escribí el nombre del proveedor" })
    .max(PROVEEDOR_NOMBRE_MAX, { error: "El nombre es demasiado largo" }),
  telefono: telefonoSchema,
  nota: z
    .string()
    .trim()
    .max(PROVEEDOR_NOTA_MAX, { error: "La nota es demasiado larga" })
    .transform((v) => (v === "" ? null : v)),
});

export type ProveedorInput = z.input<typeof proveedorSchema>;
