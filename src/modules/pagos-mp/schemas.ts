import { z } from "zod";

export const puntoQrSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Poné un nombre para este QR.")
    .max(60, "El nombre es demasiado largo."),
  externalPosId: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9]{1,40}$/,
      "El identificador va sin espacios ni símbolos, tal como figura en Mercado Pago.",
    ),
});

export const iniciarCobroSchema = z.object({
  puntoId: z.uuid(),
  monto: z.number().positive().max(9_999_999_999.99),
});

export const cobroIdSchema = z.uuid();

export type PuntoQrInput = z.infer<typeof puntoQrSchema>;
export type IniciarCobroInput = z.infer<typeof iniciarCobroSchema>;
