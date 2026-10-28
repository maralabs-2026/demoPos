import { z } from "zod";

export const abrirCajaSchema = z.object({
  montoInicial: z
    .number({ error: "Escribí el monto inicial" })
    .finite({ error: "Escribí el monto inicial" })
    .min(0, { error: "El monto inicial no puede ser negativo" })
    .max(9_999_999_999.99, { error: "El monto inicial es demasiado alto" }),
});

export type AbrirCajaInput = z.infer<typeof abrirCajaSchema>;
