// Fechas en UTC en la base; se muestran en la zona del comercio.
const TIME_ZONE = "America/Argentina/Cordoba";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "24/10/2026, 15:30"
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
