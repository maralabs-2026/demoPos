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
  // Solo para productos con precio al cobrar (0032); en los demás la base lo ignora.
  precio: z.number().finite().positive().max(9_999_999_999.99).optional(),
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
  // Lo genera la pantalla: si la respuesta se pierde, la misma venta se reenvía sin conexión con
  // este id y no se duplica (0029).
  ventaId: z.uuid().optional(),
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

// Venta cobrada sin internet (0028). El dispositivo manda lo que se cobró: precio, promo y
// descuentos de cada línea. La base controla que las cuentas cierren y el tope del rol.
const montoNoNegativoSchema = z.number().finite().min(0).max(9_999_999_999.99);

export const itemSinConexionSchema = z
  .object({
    productoId: z.uuid(),
    cantidad: z.number().int().positive(),
    precioUnitario: montoNoNegativoSchema,
    // Descuento total de la línea en pesos (promo + manual).
    descuento: montoNoNegativoSchema,
    promocionDescuento: montoNoNegativoSchema,
    promocionNombre: z.string().trim().max(200).nullable(),
  })
  .refine((i) => i.promocionDescuento <= i.descuento, {
    error: "El descuento de la promo no puede superar el de la línea",
  })
  .refine((i) => i.descuento <= i.precioUnitario * i.cantidad, {
    error: "El descuento no puede superar el importe de la línea",
  });

export const ventaSinConexionSchema = z.object({
  // Lo genera el dispositivo: reenviar la misma venta no la duplica.
  ventaId: z.uuid({ error: "La venta no tiene id" }),
  cajaId: z.uuid({ error: "La venta no tiene caja" }),
  // Hora en que se cobró, con zona: la base la acepta solo dentro del turno de la caja.
  fecha: z.iso.datetime({
    offset: true,
    error: "La hora de la venta no es válida",
  }),
  items: z
    .array(itemSinConexionSchema)
    .min(1, "La venta no tiene productos")
    .max(ITEMS_VENTA_MAX)
    .refine(
      (items) => new Set(items.map((i) => i.productoId)).size === items.length,
      {
        error: "Un producto aparece dos veces en la venta",
      },
    ),
  pagos: z
    .array(pagoVentaSchema)
    .min(1, "La venta no tiene pagos")
    .max(PAGOS_VENTA_MAX),
  // Descuento sobre el total, en pesos.
  descuento: montoNoNegativoSchema,
});

export type VentaSinConexionInput = z.infer<typeof ventaSinConexionSchema>;
