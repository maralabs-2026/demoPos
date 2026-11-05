import { z } from "zod";

export const MOTIVO_ANULACION_MAX = 180;

export const anularVentaSchema = z.object({
  ventaId: z.uuid({ error: "La venta no es válida" }),
  motivo: z
    .string({ error: "Escribí el motivo" })
    .trim()
    .min(1, { error: "Escribí el motivo" })
    .max(MOTIVO_ANULACION_MAX, {
      error: `El motivo puede tener hasta ${MOTIVO_ANULACION_MAX} caracteres`,
    }),
});

export type AnularVentaInput = z.infer<typeof anularVentaSchema>;

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

// Topes contra entradas absurdas, muy por encima de una venta real. El carrito junta por
// producto, así que ITEMS_VENTA_MAX cuenta productos distintos.
export const ITEMS_VENTA_MAX = 200;
export const PAGOS_VENTA_MAX = 20;

export const registrarVentaSchema = z.object({
  cajaId: z.string().uuid({ error: "Abrí tu caja para cobrar" }),
  items: z
    .array(itemVentaSchema)
    .min(1, "El carrito está vacío")
    .max(ITEMS_VENTA_MAX, {
      error: `La venta puede tener hasta ${ITEMS_VENTA_MAX} productos distintos`,
    }),
  pagos: z
    .array(pagoVentaSchema)
    .min(1, "Elegí un medio de pago")
    .max(PAGOS_VENTA_MAX, {
      error: `La venta puede tener hasta ${PAGOS_VENTA_MAX} pagos`,
    }),
  // Descuento sobre el total, en porcentaje.
  descuentoPct: porcentajeSchema.optional(),
});

export type RegistrarVentaInput = z.infer<typeof registrarVentaSchema>;
