import { z } from "zod";

const MONTO_MAX = 9_999_999_999.99;

export const abrirCajaSchema = z.object({
  montoInicial: z
    .number({ error: "Escribí el monto inicial" })
    .finite({ error: "Escribí el monto inicial" })
    .min(0, { error: "El monto inicial no puede ser negativo" })
    .max(MONTO_MAX, { error: "El monto inicial es demasiado alto" }),
});

export type AbrirCajaInput = z.infer<typeof abrirCajaSchema>;

export const NOTA_CIERRE_MAX = 300;

export const cerrarCajaSchema = z.object({
  cajaId: z.uuid({ error: "La caja no es válida" }),
  conteos: z
    .array(
      z.object({
        medioPagoId: z.uuid({ error: "El medio de pago no es válido" }),
        contado: z
          .number({ error: "Escribí cuánto contaste" })
          .finite({ error: "Escribí cuánto contaste" })
          .min(0, { error: "Lo contado no puede ser negativo" })
          .max(MONTO_MAX, { error: "Lo contado es demasiado alto" })
          .multipleOf(0.01, { error: "Usá hasta dos decimales" }),
      }),
    )
    .min(1, { error: "Falta el conteo" }),
  nota: z
    .string()
    .trim()
    .max(NOTA_CIERRE_MAX, {
      error: `La nota puede tener hasta ${NOTA_CIERRE_MAX} caracteres`,
    }),
});

export type CerrarCajaInput = z.infer<typeof cerrarCajaSchema>;
