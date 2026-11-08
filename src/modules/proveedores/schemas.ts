import { z } from "zod";

export const PROVEEDOR_NOMBRE_MAX = 120;
export const PROVEEDOR_NOTA_MAX = 300;

// Solo dígitos y con código de país, para armar el enlace de WhatsApp. Vacío = sin teléfono.
const telefonoSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || /^[0-9]{10,15}$/.test(v), {
    error: "Escribí el teléfono con código de país, por ejemplo 5493511234567",
  })
  .transform((v) => (v === "" ? null : v));

export const proveedorSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, { error: "Escribí el nombre del proveedor" })
    .max(PROVEEDOR_NOMBRE_MAX, { error: "El nombre es demasiado largo" }),
  telefono: telefonoSchema,
  nota: z
    .string()
    .trim()
    .max(PROVEEDOR_NOTA_MAX, { error: "La nota es demasiado larga" })
    .transform((v) => (v === "" ? null : v)),
});

export type ProveedorInput = z.input<typeof proveedorSchema>;

// ---- Compras ----

export const COMPRA_ITEMS_MAX = 200;
const montoSchema = z.number().finite().min(0).max(9_999_999_999.99);

export const compraItemSchema = z.object({
  productoId: z.uuid(),
  cantidad: z
    .number({ error: "Escribí la cantidad" })
    .int({ error: "La cantidad tiene que ser un número entero" })
    .min(1, { error: "La cantidad tiene que ser mayor a 0" })
    .max(100_000, { error: "La cantidad es demasiado grande" }),
  costoLista: montoSchema,
  bonificacionPct: z
    .number()
    .min(0, { error: "La bonificación va de 0 a 100" })
    .max(100, { error: "La bonificación va de 0 a 100" }),
  vencimiento: z.iso
    .date({ error: "Revisá la fecha de vencimiento" })
    .nullable(),
});

const pagoCompraSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("caja"),
    cajaId: z.uuid({ error: "Elegí una caja" }),
  }),
  z.object({ tipo: z.literal("fuera") }),
  z.object({
    tipo: z.literal("por_pagar"),
    vencimiento: z.iso
      .date({ error: "Revisá el vencimiento del pago" })
      .nullable(),
  }),
]);

export const compraSchema = z.object({
  proveedorId: z.uuid({ error: "Elegí un proveedor" }),
  comprobante: z
    .string()
    .trim()
    .max(60, { error: "El comprobante es demasiado largo" }),
  items: z
    .array(compraItemSchema)
    .min(1, { error: "Agregá al menos un producto" })
    .max(COMPRA_ITEMS_MAX, { error: "La compra tiene demasiados productos" })
    .refine(
      (items) => new Set(items.map((i) => i.productoId)).size === items.length,
      {
        error: "Un producto aparece dos veces",
      },
    ),
  pago: pagoCompraSchema,
});

export type CompraInput = z.input<typeof compraSchema>;
