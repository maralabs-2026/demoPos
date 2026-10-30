import { z } from "zod";

const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "La hora tiene que ser HH:MM" });

const entero = (min: number, mensaje: string) =>
  z
    .number({ error: mensaje })
    .int({ error: mensaje })
    .min(min, { error: mensaje });

export const promocionSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, { error: "Ponele un nombre a la promo" })
      .max(120, { error: "El nombre es demasiado largo" }),
    tipo: z.enum(["nxm", "precio_cantidad", "porcentaje"], {
      error: "Elegí el tipo de promo",
    }),
    alcance: z.enum(["producto", "categoria"], {
      error: "Elegí si aplica a un producto o a una categoría",
    }),
    productoId: z.string().uuid().nullable(),
    categoriaId: z.string().uuid().nullable(),
    lleva: entero(2, "Lleva tiene que ser un número de 2 o más").nullable(),
    paga: entero(1, "Paga tiene que ser un número de 1 o más").nullable(),
    cantidad: entero(2, "La cantidad tiene que ser de 2 o más").nullable(),
    precio: z
      .number()
      .nonnegative({ error: "El precio no puede ser negativo" })
      .nullable(),
    porcentaje: z
      .number({ error: "Escribí el porcentaje" })
      .gt(0, { error: "El porcentaje tiene que ser mayor a 0" })
      .max(100, { error: "El porcentaje no puede pasar del 100 %" })
      .nullable(),
    dias: z
      .array(z.number().int().min(0).max(6))
      .min(1, { error: "Elegí al menos un día" }),
    desde: hora,
    hasta: hora,
  })
  .superRefine((p, ctx) => {
    const tieneAlcance =
      p.alcance === "producto" ? p.productoId : p.categoriaId;
    if (!tieneAlcance) {
      ctx.addIssue({
        code: "custom",
        path: [p.alcance === "producto" ? "productoId" : "categoriaId"],
        message:
          p.alcance === "producto"
            ? "Elegí un producto"
            : "Elegí una categoría",
      });
    }
    if (
      p.tipo === "nxm" &&
      (p.lleva === null || p.paga === null || p.paga >= p.lleva)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["paga"],
        message: "Lleva tiene que ser mayor que paga",
      });
    }
    if (
      p.tipo === "precio_cantidad" &&
      (p.cantidad === null || p.precio === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["precio"],
        message: "Escribí cuántas unidades y a qué precio",
      });
    }
    if (p.tipo === "porcentaje" && p.porcentaje === null) {
      ctx.addIssue({
        code: "custom",
        path: ["porcentaje"],
        message: "Escribí el porcentaje",
      });
    }
    if (p.desde > p.hasta) {
      ctx.addIssue({
        code: "custom",
        path: ["hasta"],
        message: "La hora de fin tiene que ser posterior a la de inicio",
      });
    }
  });

export type PromocionInput = z.input<typeof promocionSchema>;
export type PromocionValidada = z.output<typeof promocionSchema>;
