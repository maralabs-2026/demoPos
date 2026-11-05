import { z } from "zod";

export const NOMBRE_CONFIG_MAX = 60;
// Cada medio, activo o no, puede aparecer en el conteo del cierre, que acepta hasta 50
// (CONTEOS_CIERRE_MAX en caja/schemas.ts). Si se sube uno, hay que subir el otro.
export const MEDIOS_PAGO_MAX = 50;
export const TEXTO_TICKET_MAX = 120;

const nombre = z
  .string({ error: "Escribí el nombre" })
  .trim()
  .min(1, "Escribí el nombre")
  .max(
    NOMBRE_CONFIG_MAX,
    `El nombre puede tener hasta ${NOMBRE_CONFIG_MAX} caracteres`,
  );

const textoTicket = z
  .string()
  .trim()
  .max(
    TEXTO_TICKET_MAX,
    `Cada texto puede tener hasta ${TEXTO_TICKET_MAX} caracteres`,
  );

export const ticketSchema = z.object({
  titulo: textoTicket.min(1, "Escribí el título del ticket"),
  leyenda: textoTicket,
  pie: textoTicket,
});

// Cuenta corriente es un punto de extensión: no se ofrece todavía (sección 7 de CLAUDE.md).
export const TIPOS_MEDIO_PAGO = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "qr",
] as const;

export const crearMedioPagoSchema = z.object({
  nombre,
  tipo: z.enum(TIPOS_MEDIO_PAGO, { error: "Elegí el tipo" }),
});

const id = z.uuid({ error: "El dato no es válido" });

export const renombrarSchema = z.object({ id, nombre });

export const crearCategoriaSchema = z.object({ nombre });

export type TicketInput = z.infer<typeof ticketSchema>;
export type CrearMedioPagoInput = z.infer<typeof crearMedioPagoSchema>;
export type RenombrarInput = z.infer<typeof renombrarSchema>;
export type CrearCategoriaInput = z.infer<typeof crearCategoriaSchema>;
