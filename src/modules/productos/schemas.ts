import { z } from "zod";

export const buscarProductosSchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type BuscarProductosInput = z.infer<typeof buscarProductosSchema>;

// Largos de código de barras habituales en un kiosco: EAN-8, UPC-A/EAN-12, EAN-13, ITF-14.
const LARGOS_CODIGO_BARRAS_VALIDOS = [8, 12, 13, 14];

// Dígito verificador GS1 (mod 10, pesos 3/1 alternados desde el dígito más a la derecha
// del código, sin contar el propio verificador). El mismo algoritmo vale para los 4 largos.
export function tieneDigitoVerificadorValido(codigo: string): boolean {
  if (!/^\d+$/.test(codigo)) return false;
  if (!LARGOS_CODIGO_BARRAS_VALIDOS.includes(codigo.length)) return false;

  const digitos = codigo.split("").map(Number);
  const verificador = digitos.pop()!;
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    const posicionDesdeDerecha = digitos.length - 1 - i;
    const peso = posicionDesdeDerecha % 2 === 0 ? 3 : 1;
    suma += digitos[i] * peso;
  }
  const calculado = (10 - (suma % 10)) % 10;
  return calculado === verificador;
}

export const codigoBarrasSchema = z
  .string()
  .trim()
  .refine(
    (v) => /^\d+$/.test(v),
    "El código de barras solo puede tener números",
  )
  .refine(
    (v) => LARGOS_CODIGO_BARRAS_VALIDOS.includes(v.length),
    `Debe tener ${LARGOS_CODIGO_BARRAS_VALIDOS.join(", ")} dígitos`,
  )
  .refine(
    tieneDigitoVerificadorValido,
    "El código de barras no es válido (dígito verificador)",
  );

export const unidadVentaSchema = z.enum(["unidad", "pack"]);

// "" (campo vacío en un input) se trata como "no cargado", no como 0: un costo de $0 y un
// costo sin cargar significan cosas distintas para el margen calculado.
const costoOpcionalSchema = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().nonnegative("El costo no puede ser negativo").optional(),
);

export const productoFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre").max(200),
  categoriaId: z.string().uuid("Elegí una categoría"),
  codigoBarras: codigoBarrasSchema,
  costo: costoOpcionalSchema,
  precio: z.coerce.number().positive("El precio tiene que ser mayor a 0"),
  unidadVenta: unidadVentaSchema,
  stockMinimo: z.coerce
    .number()
    .int("Tiene que ser un número entero")
    .nonnegative("No puede ser negativo"),
});

export type ProductoFormInput = z.infer<typeof productoFormSchema>;

// Margen sobre el precio de venta: (precio - costo) / precio * 100.
// null cuando no hay costo cargado o el precio es 0 (no se puede calcular).
export function calcularMargen(
  precio: number,
  costo: number | undefined,
): number | null {
  if (costo === undefined || Number.isNaN(costo)) return null;
  if (!precio || precio <= 0) return null;
  return ((precio - costo) / precio) * 100;
}

// Fila de un CSV de importación: todo llega como texto, así que los numéricos se convierten
// (coerce) antes de validar. La categoría se referencia por nombre, no por id, porque es lo
// que un comerciante puede escribir en una planilla sin mirar la base.
export const csvProductoRowSchema = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre"),
  categoria: z.string().trim().min(1, "Falta la categoría"),
  codigo_barras: codigoBarrasSchema,
  costo: costoOpcionalSchema,
  precio: z.coerce.number().positive("El precio tiene que ser mayor a 0"),
  unidad_venta: unidadVentaSchema,
  stock_minimo: z.coerce
    .number()
    .int("Tiene que ser un número entero")
    .nonnegative("No puede ser negativo"),
});

export type CsvProductoRow = z.infer<typeof csvProductoRowSchema>;
