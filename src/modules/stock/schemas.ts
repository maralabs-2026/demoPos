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
  // Opcional: fecha de vencimiento de esta mercadería (AAAA-MM-DD). Vacía = sin fecha.
  vencimiento: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.iso.date({ error: "Revisá la fecha de vencimiento" }).optional()),
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
export function cantidadConSigno(
  ajuste: z.output<typeof ajusteSchema>,
): number {
  return ajuste.sentido === "restar" ? -ajuste.cantidad : ajuste.cantidad;
}

export const auditoriaSchema = z.object({
  // null: los productos sin categoría.
  categoriaId: z.string().uuid().nullable(),
  conteos: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        contado: z
          .number({ error: "Escribí cuánto contaste" })
          .int("Contá unidades enteras")
          .min(0, "Lo contado no puede ser negativo")
          .max(1_000_000, "La cantidad es demasiado grande"),
      }),
    )
    .min(1, "Contá al menos un producto")
    .max(5000, "Son demasiados productos para una auditoría"),
});

export type AuditoriaInput = z.input<typeof auditoriaSchema>;
