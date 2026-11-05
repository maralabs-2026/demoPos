// Enlace para compartir un texto: WhatsApp pide elegir el contacto. Nunca lleva un destinatario.
export function enlaceWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
