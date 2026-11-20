import { sumarDias } from "@/lib/date";

// Sin dependencias de servidor: lo usa la lista del control en el navegador.
export type Frecuencia = "dia" | "semana" | "mes";

// Clave de cada período a partir de la fecha de hoy ("2026-11-20"): lo tildado vale para ese día,
// esa semana (de lunes a domingo) o ese mes, y en el período siguiente arranca de cero.
export function clavePeriodo(frecuencia: Frecuencia, hoy: string): string {
  if (frecuencia === "dia") return hoy;
  if (frecuencia === "mes") return hoy.slice(0, 7);
  const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return sumarDias(hoy, -((diaSemana + 6) % 7));
}
