import { z } from "zod";

export const itemVentaSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.number().int().positive(),
});

export const registrarVentaSchema = z.object({
  items: z.array(itemVentaSchema).min(1, "El carrito está vacío"),
  medioPagoId: z.string().uuid(),
  montoRecibido: z.number().nonnegative().optional(),
});

export type RegistrarVentaInput = z.infer<typeof registrarVentaSchema>;
