import { finDelDia, inicioDelDia } from "@/lib/date";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import type { FiltrosReporte } from "./schemas";

export type ReporteVentas = {
  resumen: {
    ventas: number;
    total: number;
    descuentos: number;
    anuladas: number;
    totalAnulado: number;
    ganancia: number;
    sinCosto: number;
    gastosPagados: number;
  };
  periodos: {
    periodo: string;
    ventas: number;
    total: number;
    ganancia: number;
  }[];
  ranking: {
    productoId: string;
    nombre: string;
    cantidad: number;
    total: number;
  }[];
  porCajero: {
    usuarioId: string;
    nombre: string;
    ventas: number;
    total: number;
  }[];
  porMedio: { nombre: string; total: number }[];
};

type ReporteRow = {
  resumen: {
    ventas: number;
    total: number;
    descuentos: number;
    anuladas: number;
    total_anulado: number;
    ganancia: number;
    sin_costo: number;
    gastos_pagados: number;
  };
  periodos: {
    periodo: string;
    ventas: number;
    total: number;
    ganancia: number;
  }[];
  ranking: {
    producto_id: string;
    nombre: string;
    cantidad: number;
    total: number;
  }[];
  por_cajero: {
    usuario_id: string;
    nombre: string;
    ventas: number;
    total: number;
  }[];
  por_medio: { nombre: string; total: number }[];
};

export async function getReporteVentas(
  filtros: FiltrosReporte,
): Promise<ActionResult<ReporteVentas>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reporte_ventas", {
    p_desde: filtros.desde,
    p_hasta: filtros.hasta,
    p_agrupar: filtros.agrupar,
    p_usuario_id: filtros.usuarioId,
  });
  if (error) return fail("No se pudo armar el reporte.");

  const r = data as ReporteRow;
  return ok({
    resumen: {
      ventas: Number(r.resumen.ventas),
      total: Number(r.resumen.total),
      descuentos: Number(r.resumen.descuentos),
      anuladas: Number(r.resumen.anuladas),
      totalAnulado: Number(r.resumen.total_anulado),
      ganancia: Number(r.resumen.ganancia),
      sinCosto: Number(r.resumen.sin_costo),
      gastosPagados: Number(r.resumen.gastos_pagados),
    },
    periodos: r.periodos.map((p) => ({
      periodo: p.periodo,
      ventas: Number(p.ventas),
      total: Number(p.total),
      ganancia: Number(p.ganancia),
    })),
    ranking: r.ranking.map((p) => ({
      productoId: p.producto_id,
      nombre: p.nombre,
      cantidad: Number(p.cantidad),
      total: Number(p.total),
    })),
    porCajero: r.por_cajero.map((c) => ({
      usuarioId: c.usuario_id,
      nombre: c.nombre,
      ventas: Number(c.ventas),
      total: Number(c.total),
    })),
    porMedio: r.por_medio.map((m) => ({
      nombre: m.nombre,
      total: Number(m.total),
    })),
  });
}

export type Cajero = { id: string; nombre: string };

// Quiénes vendieron o pueden vender, para el filtro. La RLS de perfiles lo limita al comercio.
export async function getCajeros(): Promise<ActionResult<Cajero[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre")
    .order("nombre")
    .overrideTypes<Cajero[]>();
  if (error) return fail("No se pudieron leer los usuarios.");
  return ok(data);
}

export type VentaExportada = {
  fecha: string;
  numero: string;
  cajero: string;
  estado: string;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  promocion: string;
  subtotal: number;
  costoUnitario: number | null;
};

type ItemExportRow = {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  promocion_nombre: string | null;
  subtotal: number;
  venta_items_costos: { costo: number } | null;
  ventas: {
    id: string;
    created_at: string;
    estado: string;
    cajero: { nombre: string } | null;
  };
};

const TAMANO_PAGINA = 1000; // Lo máximo que devuelve PostgREST en una consulta.
export const MAX_FILAS_EXPORTADAS = 30_000; // Vercel limita el tamaño de la respuesta.

// Ítems vendidos del período, paginando. truncado avisa si quedaron filas afuera.
export async function getVentasParaExportar(
  filtros: FiltrosReporte,
  corteHoras = 0,
): Promise<ActionResult<{ filas: VentaExportada[]; truncado: boolean }>> {
  const supabase = await createClient();
  const filas: VentaExportada[] = [];

  for (let inicio = 0; ; inicio += TAMANO_PAGINA) {
    let query = supabase
      .from("venta_items")
      .select(
        `nombre, cantidad, precio_unitario, descuento, promocion_nombre, subtotal,
         venta_items_costos(costo),
         ventas!inner(id, created_at, estado, usuario_id,
           cajero:perfiles!ventas_usuario_id_comercio_id_fkey(nombre))`,
      )
      .gte("ventas.created_at", inicioDelDia(filtros.desde, corteHoras))
      .lt("ventas.created_at", finDelDia(filtros.hasta, corteHoras));
    if (filtros.usuarioId) {
      query = query.eq("ventas.usuario_id", filtros.usuarioId);
    }

    const { data, error } = await query
      .order("id")
      .range(inicio, inicio + TAMANO_PAGINA - 1)
      .overrideTypes<ItemExportRow[]>();
    if (error) return fail("No se pudieron leer las ventas para exportar.");

    for (const row of data) {
      filas.push({
        fecha: row.ventas.created_at,
        numero: row.ventas.id.slice(0, 8).toUpperCase(),
        cajero: row.ventas.cajero?.nombre ?? "",
        estado: row.ventas.estado === "anulada" ? "Anulada" : "Completada",
        producto: row.nombre,
        cantidad: row.cantidad,
        precioUnitario: Number(row.precio_unitario),
        descuento: Number(row.descuento),
        promocion: row.promocion_nombre ?? "",
        subtotal: Number(row.subtotal),
        costoUnitario: row.venta_items_costos
          ? Number(row.venta_items_costos.costo)
          : null,
      });
    }

    if (data.length < TAMANO_PAGINA) {
      filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
      return ok({ filas, truncado: false });
    }
    if (filas.length >= MAX_FILAS_EXPORTADAS) {
      filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
      return ok({ filas, truncado: true });
    }
  }
}
