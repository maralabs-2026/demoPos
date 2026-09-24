import { z } from "zod";

export const buscarProductosSchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type BuscarProductosInput = z.infer<typeof buscarProductosSchema>;

export const productoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(200, "El nombre es demasiado largo"),

  codigoBarras: z
    .string()
    .trim()
    .min(1, "El código de barras es obligatorio")
    .max(100, "El código de barras es demasiado largo"),

  categoriaId: z.string().uuid("Seleccioná una categoría"),

  precio: z
    .number()
    .finite("El precio debe ser un número válido")
    .min(0, "El precio no puede ser negativo"),

  unidadVenta: z
    .string()
    .trim()
    .min(1, "La unidad de venta es obligatoria")
    .max(50),

  stockMinimo: z
    .number()
    .int("El stock mínimo debe ser un número entero")
    .min(0, "El stock mínimo no puede ser negativo"),
});

export type ProductoInput = z.infer<typeof productoSchema>;
