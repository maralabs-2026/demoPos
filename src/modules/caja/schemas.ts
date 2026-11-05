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

export const MOTIVO_MOVIMIENTO_MAX = 200;

export const registrarMovimientoSchema = z.object({
  cajaId: z.uuid({ error: "La caja no es válida" }),
  tipo: z.enum(["retiro", "ingreso"], { error: "Elegí retiro o ingreso" }),
  monto: z
    .number({ error: "Escribí el monto" })
    .finite({ error: "Escribí el monto" })
    .positive({ error: "El monto tiene que ser mayor a cero" })
    .max(MONTO_MAX, { error: "El monto es demasiado alto" })
    .multipleOf(0.01, { error: "Usá hasta dos decimales" }),
  motivo: z
    .string({ error: "Escribí el motivo" })
    .trim()
    .min(1, { error: "Escribí el motivo" })
    .max(MOTIVO_MOVIMIENTO_MAX, {
      error: `El motivo puede tener hasta ${MOTIVO_MOVIMIENTO_MAX} caracteres`,
    }),
});

export type RegistrarMovimientoInput = z.infer<
  typeof registrarMovimientoSchema
>;
