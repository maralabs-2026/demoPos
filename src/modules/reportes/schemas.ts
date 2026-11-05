import { z } from "zod";

export type Agrupacion = "dia" | "semana" | "mes";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Una fecha real "aaaa-mm-dd", o null. "2026-02-31" no pasa: Date la correría a marzo.
export function fechaValida(valor: string | undefined): string | null {
  if (!valor || !FECHA.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(valor)
    ? valor
    : null;
}

const MAX_DIAS = 1100; // Mismo tope que reporte_ventas.

const uuid = z.uuid();

export type FiltrosReporte = {
  desde: string;
  hasta: string;
  agrupar: Agrupacion;
  usuarioId: string | null;
};

// Filtros de la URL: lo que no sirve vuelve al valor por defecto, sin romper la pantalla.
export function filtrosDesdeParams(
  params: {
    desde?: string;
    hasta?: string;
    agrupar?: string;
    cajero?: string;
  },
  hoy: string,
): FiltrosReporte {
  let desde = fechaValida(params.desde) ?? hoy;
  let hasta = fechaValida(params.hasta) ?? hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  const dias =
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) /
    86_400_000;
  if (dias > MAX_DIAS) desde = hasta;

  const agrupar: Agrupacion =
    params.agrupar === "semana" || params.agrupar === "mes"
      ? params.agrupar
      : "dia";

  return {
    desde,
    hasta,
    agrupar,
    usuarioId: uuid.safeParse(params.cajero).success
      ? (params.cajero as string)
      : null,
  };
}
