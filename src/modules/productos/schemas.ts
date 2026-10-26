import { z } from "zod";

export const buscarProductosSchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type BuscarProductosInput = z.infer<typeof buscarProductosSchema>;

// Mismos límites que la función actualizar_precios (migración 0010).
export const PORCENTAJE_MIN = -50;
export const PORCENTAJE_MAX = 200;

export const actualizarPreciosSchema = z.object({
  // null = todo el catálogo.
  categoriaId: z.uuid({ error: "Elegí una categoría" }).nullable(),
  porcentaje: z
    .number({ error: "Escribí un porcentaje" })
    .finite({ error: "Escribí un porcentaje" })
    .min(PORCENTAJE_MIN, { error: `El porcentaje mínimo es ${PORCENTAJE_MIN} %` })
    .max(PORCENTAJE_MAX, { error: `El porcentaje máximo es ${PORCENTAJE_MAX} %` })
    .refine((value) => value !== 0, { error: "El porcentaje no puede ser 0" }),
});

export type ActualizarPreciosInput = z.input<typeof actualizarPreciosSchema>;

// Igual que en SQL: round(precio * (1 + pct / 100), 2). Se usa para la vista previa.
export function precioActualizado(precio: number, porcentaje: number): number {
  // Se opera en centavos enteros para que el redondeo coincida con el numeric de Postgres.
  const centavos = Math.round(precio * 100);
  return Math.round((centavos * (100 + porcentaje)) / 100) / 100;
}
