import { z } from "zod";
import { LOGO_MAX_BYTES } from "@/lib/logo";

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

export const comercioNombreSchema = z.object({ nombre });

// Hora a la que termina el día comercial: 0 es medianoche. Hasta las 12, porque más tarde ya no es
// "la madrugada del día anterior".
export const CORTE_DIA_MAX = 12;
export const corteDiaSchema = z.object({
  horas: z
    .number({ error: "Elegí una hora" })
    .int({ error: "Elegí una hora en punto" })
    .min(0, { error: "Elegí una hora entre 0 y 12" })
    .max(CORTE_DIA_MAX, { error: "Elegí una hora entre 0 y 12" }),
});

// Con cuántos días de anticipación avisa el inicio lo que está por vencer (0033).
export const AVISO_VENCIMIENTO_DEFECTO = 30;
export const AVISO_VENCIMIENTO_MAX = 180;
export const avisoVencimientoSchema = z.object({
  dias: z
    .number({ error: "Escribí los días de aviso" })
    .int({ error: "Escribí un número entero de días" })
    .min(1, { error: "Escribí entre 1 y 180 días" })
    .max(AVISO_VENCIMIENTO_MAX, { error: "Escribí entre 1 y 180 días" }),
});

// El tipo real se comprueba en el servidor por los primeros bytes (tipoDeLogo, en lib/logo.ts).
export const logoSchema = z.object({
  logo: z
    .file({ error: "Elegí una imagen" })
    .min(1, { error: "Elegí una imagen" })
    .max(LOGO_MAX_BYTES, { error: "La imagen puede pesar hasta 512 KB" }),
});

export type TicketInput = z.infer<typeof ticketSchema>;
export type CrearMedioPagoInput = z.infer<typeof crearMedioPagoSchema>;
export type RenombrarInput = z.infer<typeof renombrarSchema>;
export type CrearCategoriaInput = z.infer<typeof crearCategoriaSchema>;
export type ComercioNombreInput = z.infer<typeof comercioNombreSchema>;
export type CorteDiaInput = z.infer<typeof corteDiaSchema>;
export type AvisoVencimientoInput = z.infer<typeof avisoVencimientoSchema>;
