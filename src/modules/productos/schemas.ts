import { z } from "zod";

export const buscarProductosSchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export type BuscarProductosInput = z.infer<typeof buscarProductosSchema>;
