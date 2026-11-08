// Enlace para mandar un texto por WhatsApp. Sin teléfono, WhatsApp pide elegir el contacto; con
// teléfono (solo dígitos, con código de país) abre el chat de ese número, como el pedido al proveedor.
export function enlaceWhatsApp(
  texto: string,
  telefono?: string | null,
): string {
  return `https://wa.me/${telefono ?? ""}?text=${encodeURIComponent(texto)}`;
}
