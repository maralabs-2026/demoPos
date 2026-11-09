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

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "15:30"
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

// Una fecha sin hora ("2026-10-24") a "24/10/2026". No pasa por Date: no tiene zona horaria que
// convertir, y hacerlo la correría un día.
export function formatDate(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Una fecha "aaaa-mm-dd" corrida n días. Se calcula en UTC para que ninguna zona horaria la mueva.
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Límites de un día en la zona del comercio, para filtrar por created_at. Argentina no cambia la
// hora: el desplazamiento es siempre -03:00. `corteHoras` es la hora a la que termina el día
// comercial (0 = medianoche): con 6, el día 24 va del 24 a las 6:00 al 25 a las 6:00.
export function inicioDelDia(fecha: string, corteHoras = 0): string {
  const hora = String(corteHoras).padStart(2, "0");
  return `${fecha}T${hora}:00:00-03:00`;
}

export function finDelDia(fecha: string, corteHoras = 0): string {
  return inicioDelDia(sumarDias(fecha, 1), corteHoras);
}

// La fecha de hoy en la zona del comercio, como "2026-10-24". Con hora de corte, antes de esa hora
// todavía es el día anterior.
export function todayISO(now: Date = new Date(), corteHoras = 0): string {
  return todayFormatter.format(
    new Date(now.getTime() - corteHoras * 3_600_000),
  );
}
