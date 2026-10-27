import { z } from "zod";
import { parseMonto } from "@/lib/currency";

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

// ---- Importación desde CSV ----

export const CSV_COLUMNAS = [
  "nombre",
  "categoria",
  "codigo_barras",
  "costo",
  "precio",
  "unidad_venta",
  "stock_minimo",
] as const;

// Mismo tope que acepta la función importar_productos (migración 0011).
export const CSV_MAX_FILAS = 1000;

// Monto escrito en una planilla: "1.234,50", "1234.5" o "$ 900". Vacío = null.
const montoCsv = (campo: string, opcional: boolean) =>
  z.string().transform((texto, ctx) => {
    const valor = parseMonto(texto);
    if (valor === null) {
      if (opcional) return null;
      ctx.addIssue({ code: "custom", message: `Falta el ${campo}` });
      return z.NEVER;
    }
    if (Number.isNaN(valor)) {
      ctx.addIssue({
        code: "custom",
        message: `El ${campo} no es un monto válido`,
      });
      return z.NEVER;
    }
    return valor;
  });

const enteroCsv = z.string().transform((texto, ctx) => {
  const limpio = texto.trim();
  if (!/^-?\d+$/.test(limpio)) {
    ctx.addIssue({
      code: "custom",
      message: "El stock mínimo debe ser un número entero",
    });
    return z.NEVER;
  }
  return Number(limpio);
});

// Fila de un CSV de importación: todo llega como texto. La categoría va por nombre, que es lo
// que un comerciante escribe en una planilla; el servidor la resuelve contra la base.
export const csvProductoRowSchema = z
  .object({
    nombre: z.string(),
    categoria: z.string(),
    codigo_barras: z.string(),
    costo: montoCsv("costo", true),
    precio: montoCsv("precio", false),
    unidad_venta: z.string(),
    stock_minimo: enteroCsv,
  })
  .transform((fila) => ({
    nombre: fila.nombre,
    codigoBarras: fila.codigo_barras,
    categoria: fila.categoria.trim() === "" ? null : fila.categoria.trim(),
    costo: fila.costo,
    precio: fila.precio,
    unidadVenta: fila.unidad_venta,
    stockMinimo: fila.stock_minimo,
  }))
  .pipe(
    productoSchema.omit({ categoriaId: true }).extend({
      categoria: z
        .string()
        .max(100, { error: "El nombre de la categoría es demasiado largo" })
        .nullable(),
    }),
  );

export type ProductoCsv = z.output<typeof csvProductoRowSchema>;

// Igual que importar_productos (0011): sin distinguir mayúsculas ni espacios en los extremos,
// pero sí tildes ("Almacen" no es "Almacén").
export function claveCategoria(nombre: string): string {
  return nombre.trim().toLowerCase();
}

export type FilaCsvValidada =
  | { numero: number; ok: true; producto: ProductoCsv }
  | {
      numero: number;
      ok: false;
      datos: Record<string, string>;
      errores: string[];
    };

export type CsvValidado =
  { ok: false; error: string } | { ok: true; filas: FilaCsvValidada[] };

// Valida el archivo completo: encabezados, cantidad de filas, cada fila y códigos repetidos.
// Se usa en la vista previa (cliente) y otra vez en la server action antes de tocar la base.
export function validarCsvProductos(
  objetos: Record<string, string>[],
  encabezados: string[],
): CsvValidado {
  const faltantes = CSV_COLUMNAS.filter((c) => !encabezados.includes(c));
  if (faltantes.length > 0) {
    return {
      ok: false,
      error: `Faltan columnas en el archivo: ${faltantes.join(", ")}`,
    };
  }
  if (objetos.length === 0) {
    return { ok: false, error: "El archivo no tiene productos" };
  }
  if (objetos.length > CSV_MAX_FILAS) {
    return {
      ok: false,
      error: `El archivo tiene ${objetos.length} productos; el máximo por importación es ${CSV_MAX_FILAS}`,
    };
  }

  const filas: FilaCsvValidada[] = objetos.map((datos, i) => {
    // Fila 1 = encabezados, así que el primer producto está en la fila 2 de la planilla.
    const numero = i + 2;
    const resultado = csvProductoRowSchema.safeParse(datos);
    return resultado.success
      ? { numero, ok: true, producto: resultado.data }
      : {
          numero,
          ok: false,
          datos,
          errores: resultado.error.issues.map((issue) => issue.message),
        };
  });

  const primeraFila = new Map<string, number>();
  for (const fila of filas) {
    if (!fila.ok) continue;
    const codigo = fila.producto.codigoBarras;
    const anterior = primeraFila.get(codigo);
    if (anterior === undefined) {
      primeraFila.set(codigo, fila.numero);
      continue;
    }
    const repetida: FilaCsvValidada = {
      numero: fila.numero,
      ok: false,
      datos: objetos[fila.numero - 2],
      errores: [`El código ${codigo} ya aparece en la fila ${anterior}`],
    };
    filas[fila.numero - 2] = repetida;
  }

  return { ok: true, filas };
}
