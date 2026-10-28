import { z } from "zod";

export const buscarProductosSchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type BuscarProductosInput = z.infer<typeof buscarProductosSchema>;

const montoSchema = (campo: string) =>
  z
    .number({ error: `Escribí el ${campo}` })
    .finite({ error: `Escribí el ${campo}` })
    .min(0, { error: `El ${campo} no puede ser negativo` })
    .max(9_999_999_999.99, { error: `El ${campo} es demasiado alto` });

// El comercio no viaja desde el cliente: sale del perfil de la sesión (guardar_producto, 0010).
export const productoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { error: "El nombre es obligatorio" })
    .max(200, { error: "El nombre es demasiado largo" }),
  codigoBarras: z
    .string()
    .trim()
    .min(1, { error: "El código de barras es obligatorio" })
    .max(100, { error: "El código de barras es demasiado largo" }),
  // null = sin categoría (productos.categoria_id es nullable).
  categoriaId: z.uuid({ error: "Seleccioná una categoría" }).nullable(),
  // null = costo desconocido. Se guarda en productos_costos, que el cajero no puede leer.
  costo: montoSchema("costo").nullable(),
  precio: montoSchema("precio"),
  unidadVenta: z
    .string()
    .trim()
    .min(1, { error: "La unidad de venta es obligatoria" })
    .max(50, { error: "La unidad de venta es demasiado larga" }),
  stockMinimo: z
    .number({ error: "Escribí el stock mínimo" })
    .int({ error: "El stock mínimo debe ser un número entero" })
    .min(0, { error: "El stock mínimo no puede ser negativo" })
    .max(100_000, { error: "El stock mínimo es demasiado alto" }),
});

export type ProductoInput = z.input<typeof productoSchema>;

// Precio y costo que se vieron al abrir el formulario de edición (control de cambios simultáneos).
export const valoresAnterioresSchema = z.object({
  precio: z.number().finite(),
  costo: z.number().finite().nullable(),
});

export type ValoresAnteriores = z.infer<typeof valoresAnterioresSchema>;

// Margen bruto sobre el precio de venta, en porcentaje. null si no se puede calcular.
export function calcularMargen(
  costo: number | null,
  precio: number,
): number | null {
  if (costo === null || !Number.isFinite(costo) || !(precio > 0)) return null;
  return ((precio - costo) / precio) * 100;
}

// Mismos límites que la función actualizar_precios (migración 0009).
export const PORCENTAJE_MIN = -50;
export const PORCENTAJE_MAX = 200;

export const actualizarPreciosSchema = z.object({
  // null = todo el catálogo.
  categoriaId: z.uuid({ error: "Elegí una categoría" }).nullable(),
  porcentaje: z
    .number({ error: "Escribí un porcentaje" })
    .finite({ error: "Escribí un porcentaje" })
    .min(PORCENTAJE_MIN, {
      error: `El porcentaje mínimo es ${PORCENTAJE_MIN} %`,
    })
    .max(PORCENTAJE_MAX, {
      error: `El porcentaje máximo es ${PORCENTAJE_MAX} %`,
    })
    .refine((value) => value !== 0, { error: "El porcentaje no puede ser 0" }),
});

export type ActualizarPreciosInput = z.input<typeof actualizarPreciosSchema>;

// Igual que en SQL: round(precio * (1 + pct / 100), 2). Se usa para la vista previa.
export function precioActualizado(precio: number, porcentaje: number): number {
  // Se opera en centavos enteros para que el redondeo coincida con el numeric de Postgres.
  const centavos = Math.round(precio * 100);
  return Math.round((centavos * (100 + porcentaje)) / 100) / 100;
}
