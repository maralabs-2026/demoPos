import { z } from "zod";

const cantidadSchema = z
  .number({ error: "Ingresá una cantidad" })
  .int("La cantidad tiene que ser un número entero")
  .positive("La cantidad tiene que ser mayor a 0")
  .max(100000, "La cantidad es demasiado grande");

export const ingresoSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: cantidadSchema,
  // Opcional: número de remito, proveedor, etc.
  motivo: z
    .string()
    .trim()
    .max(200, "El detalle puede tener hasta 200 caracteres")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

// La cantidad va siempre en positivo; `sentido` define si suma o resta.
export const ajusteSchema = z.object({
  productoId: z.string().uuid(),
  sentido: z.enum(["sumar", "restar"]),
  cantidad: cantidadSchema,
  motivo: z
    .string({ error: "Escribí el motivo del ajuste" })
    .trim()
    .min(3, "El motivo tiene que tener al menos 3 caracteres")
    .max(200, "El motivo puede tener hasta 200 caracteres"),
});

export const movimientosProductoSchema = z.object({
  productoId: z.string().uuid(),
});

export type IngresoInput = z.input<typeof ingresoSchema>;
export type AjusteInput = z.input<typeof ajusteSchema>;

// Cantidad con signo tal como se guarda en movimientos_stock.
export function cantidadConSigno(ajuste: z.output<typeof ajusteSchema>): number {
  return ajuste.sentido === "restar" ? -ajuste.cantidad : ajuste.cantidad;
}
