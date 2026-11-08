import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

export type FilaHorario = { ventas: number; total: number };

export type ReporteAnalisis = {
  categorias: {
    categoria: string;
    total: number;
    ganancia: number;
    totalConCosto: number;
    sinCosto: number;
  }[];
  porHora: (FilaHorario & { hora: number })[];
  porDia: (FilaHorario & { dia: number })[];
  sinMovimiento: {
    productoId: string;
    nombre: string;
    stockActual: number;
    unidadVenta: string;
    inmovilizado: number | null;
    ultimaVenta: string | null;
  }[];
  sinMovimientoTotal: number;
};

type AnalisisRow = {
  categorias: {
    categoria: string;
    total: number;
    ganancia: number;
    total_con_costo: number;
    sin_costo: number;
  }[];
  por_hora: { hora: number; ventas: number; total: number }[];
  por_dia: { dia: number; ventas: number; total: number }[];
  sin_movimiento: {
    producto_id: string;
    nombre: string;
    stock_actual: number;
    unidad_venta: string;
    inmovilizado: number | null;
    ultima_venta: string | null;
  }[];
  sin_movimiento_total: number;
};

export async function getReporteAnalisis(
  desde: string,
  hasta: string,
): Promise<ActionResult<ReporteAnalisis>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reporte_analisis", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) return fail("No se pudo armar el análisis.");

  const r = data as AnalisisRow;
  return ok({
    categorias: r.categorias.map((c) => ({
      categoria: c.categoria,
      total: Number(c.total),
      ganancia: Number(c.ganancia),
      totalConCosto: Number(c.total_con_costo),
      sinCosto: Number(c.sin_costo),
    })),
    porHora: r.por_hora.map((h) => ({
      hora: h.hora,
      ventas: Number(h.ventas),
      total: Number(h.total),
    })),
    porDia: r.por_dia.map((d) => ({
      dia: d.dia,
      ventas: Number(d.ventas),
      total: Number(d.total),
    })),
    sinMovimiento: r.sin_movimiento.map((s) => ({
      productoId: s.producto_id,
      nombre: s.nombre,
      stockActual: Number(s.stock_actual),
      unidadVenta: s.unidad_venta,
      inmovilizado: s.inmovilizado === null ? null : Number(s.inmovilizado),
      ultimaVenta: s.ultima_venta,
    })),
    sinMovimientoTotal: Number(r.sin_movimiento_total),
  });
}
