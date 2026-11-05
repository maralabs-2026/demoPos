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
// hora: el desplazamiento es siempre -03:00.
export function inicioDelDia(fecha: string): string {
  return `${fecha}T00:00:00-03:00`;
}

export function finDelDia(fecha: string): string {
  return inicioDelDia(sumarDias(fecha, 1));
}

// La fecha de hoy en la zona del comercio, como "2026-10-24".
export function todayISO(now: Date = new Date()): string {
  return todayFormatter.format(now);
}
