import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

export type TipoActividad =
  "anulacion" | "cierre" | "retiro" | "ingreso" | "gasto";

export type Inicio = {
  hoy: { ventas: number; total: number };
  cajas: { cajaId: string; titular: string; efectivo: number }[];
  cajaPropiaOculta: boolean;
  mes: {
    total: number;
    ganancia: number;
    sinCosto: number;
    gastosPagados: number;
  };
  reposicion: number;
  cajasConDiferencia: {
    cajaId: string;
    titular: string;
    cerradaAt: string;
    diferencia: number;
  }[];
  gastos: {
    id: string;
    descripcion: string;
    monto: number;
    vencimiento: string;
  }[];
  actividad: {
    tipo: TipoActividad;
    fecha: string;
    monto: number | null;
    detalle: string | null;
    usuario: string;
    ref: string;
  }[];
  // Cobradas sin conexión con avisos (0028) que nadie revisó todavía (0030).
  ventasSinConexion: {
    ventaId: string;
    fecha: string;
    total: number;
    cajero: string;
    avisos: AvisoSinConexion[];
  }[];
  // Lo vencido y lo que vence pronto, con la cantidad estimada (0033).
  vencimientos: {
    productoId: string;
    nombre: string;
    unidadVenta: string;
    vencimiento: string;
    cantidad: number;
    vencido: boolean;
  }[];
};

type VencimientoRow = {
  producto_id: string;
  nombre: string;
  unidad_venta: string;
  vencimiento: string;
  cantidad: number;
  vencido: boolean;
};

export type AvisoSinConexion = "precio" | "stock";

// Hasta cuántas muestra el inicio: el resto aparece cuando se revisan las primeras.
const VENTAS_A_REVISAR_MAX = 20;

type VentaARevisarRow = {
  id: string;
  created_at: string;
  total: number;
  avisos_sin_conexion: AvisoSinConexion[];
  cajero: { nombre: string } | null;
};

type InicioRow = {
  hoy: { ventas: number; total: number };
  cajas: { caja_id: string; titular: string; efectivo: number }[];
  caja_propia_oculta: boolean;
  mes: {
    total: number;
    ganancia: number;
    sin_costo: number;
    gastos_pagados: number;
  };
  reposicion: number;
  cajas_con_diferencia: {
    caja_id: string;
    titular: string;
    cerrada_at: string;
    diferencia: number;
  }[];
  gastos: {
    id: string;
    descripcion: string;
    monto: number;
    vencimiento: string;
  }[];
  actividad: {
    tipo: TipoActividad;
    fecha: string;
    monto: number | null;
    detalle: string | null;
    usuario: string;
    ref: string;
  }[];
};

export async function getInicio(): Promise<ActionResult<Inicio>> {
  const supabase = await createClient();
  const [{ data, error }, aRevisar, proximos] = await Promise.all([
    supabase.rpc("inicio_resumen"),
    supabase
      .from("ventas")
      .select(
        "id, created_at, total, avisos_sin_conexion, cajero:perfiles!ventas_usuario_id_comercio_id_fkey(nombre)",
      )
      .eq("sin_conexion", true)
      .eq("estado", "completada")
      .is("revisada_at", null)
      .not("avisos_sin_conexion", "eq", "{}")
      .order("created_at", { ascending: false })
      .limit(VENTAS_A_REVISAR_MAX)
      .overrideTypes<VentaARevisarRow[], { merge: false }>(),
    supabase.rpc("vencimientos_proximos"),
  ]);
  if (error || aRevisar.error || proximos.error)
    return fail("No se pudo armar el inicio.");

  const r = data as InicioRow;
  return ok({
    hoy: { ventas: Number(r.hoy.ventas), total: Number(r.hoy.total) },
    cajas: r.cajas.map((c) => ({
      cajaId: c.caja_id,
      titular: c.titular,
      efectivo: Number(c.efectivo),
    })),
    cajaPropiaOculta: r.caja_propia_oculta,
    mes: {
      total: Number(r.mes.total),
      ganancia: Number(r.mes.ganancia),
      sinCosto: Number(r.mes.sin_costo),
      gastosPagados: Number(r.mes.gastos_pagados),
    },
    reposicion: Number(r.reposicion),
    cajasConDiferencia: r.cajas_con_diferencia.map((c) => ({
      cajaId: c.caja_id,
      titular: c.titular,
      cerradaAt: c.cerrada_at,
      diferencia: Number(c.diferencia),
    })),
    gastos: r.gastos.map((g) => ({ ...g, monto: Number(g.monto) })),
    actividad: r.actividad.map((a) => ({
      ...a,
      monto: a.monto === null ? null : Number(a.monto),
    })),
    ventasSinConexion: (aRevisar.data ?? []).map((v) => ({
      ventaId: v.id,
      fecha: v.created_at,
      total: Number(v.total),
      cajero: v.cajero?.nombre ?? "Otro usuario",
      avisos: v.avisos_sin_conexion,
    })),
    vencimientos: (proximos.data as VencimientoRow[]).map((v) => ({
      productoId: v.producto_id,
      nombre: v.nombre,
      unidadVenta: v.unidad_venta,
      vencimiento: v.vencimiento,
      cantidad: Number(v.cantidad),
      vencido: v.vencido,
    })),
  });
}
