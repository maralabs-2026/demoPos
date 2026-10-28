import { z } from "zod";

export const itemVentaSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.number().int().positive(),
});

const montoSchema = z.number().finite().positive().max(9_999_999_999.99);

// Un pago por medio. `recibido` solo para efectivo (para calcular el vuelto). La pantalla manda
// uno solo por ahora; los pagos combinados llegan en la Fase 4b sobre este mismo schema.
export const pagoVentaSchema = z.object({
  medioPagoId: z.string().uuid(),
  monto: montoSchema,
  recibido: montoSchema.optional(),
});

export const registrarVentaSchema = z.object({
  cajaId: z.string().uuid({ error: "Abrí tu caja para cobrar" }),
  items: z.array(itemVentaSchema).min(1, "El carrito está vacío"),
  pagos: z.array(pagoVentaSchema).min(1, "Elegí un medio de pago"),
});

export type RegistrarVentaInput = z.infer<typeof registrarVentaSchema>;
