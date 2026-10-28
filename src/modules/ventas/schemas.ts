import { z } from "zod";

const porcentajeSchema = z
  .number()
  .finite()
  .min(0, { error: "El descuento no puede ser negativo" })
  .max(100, { error: "El descuento no puede pasar del 100 %" });

export const itemVentaSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.number().int().positive(),
  // Porcentaje: el monto lo calcula registrar_venta (0012), con el tope del rol.
  descuentoPct: porcentajeSchema.optional(),
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
  // Descuento sobre el total, en porcentaje.
  descuentoPct: porcentajeSchema.optional(),
});

export type RegistrarVentaInput = z.infer<typeof registrarVentaSchema>;
