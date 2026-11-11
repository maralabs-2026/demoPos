import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

export type TipoActividad =
  | "anulacion"
  | "cierre"
  | "retiro"
  | "ingreso"
  | "ajuste_retiro"
  | "ajuste_ingreso"
  | "gasto";

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
    // Solo en un ajuste cargado con código: el dueño que lo autorizó.
    autorizo: string | null;
  }[];
  // Cobradas sin conexión con avisos (0028) que nadie revisó todavía (0030).
  ventasSinConexion: {
    ventaId: string;
    fecha: string;
    total: number;
    cajero: string;
    avisos: AvisoSinConexion[];
  }[];
  ventasQrManual: {
    ventaId: string;
    fecha: string;
    total: number;
    cajero: string;
  }[];
  cobrosSinVenta: {
    id: string;
    fecha: string;
    monto: number;
    conError: boolean;
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

export type AvisoSinConexion = "precio" | "stock" | "inactivo";

// Hasta cuántas muestra el inicio: el resto aparece cuando se revisan las primeras.
const VENTAS_A_REVISAR_MAX = 20;
const COBRO_SIN_VENTA_MARGEN_MS = 5 * 60_000;
const COBRO_SIN_VENTA_VENTANA_MS = 30 * 24 * 60 * 60_000;

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
    // Solo en un ajuste cargado con código: el dueño que lo autorizó.
    autorizo: string | null;
  }[];
};

export async function getInicio(): Promise<ActionResult<Inicio>> {
  const supabase = await createClient();
  const ahora = Date.now();
  const [{ data, error }, aRevisar, proximos, qrManual, cobrosSueltos] =
    await Promise.all([
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
      supabase
        .from("ventas")
        .select(
          "id, created_at, total, cajero:perfiles!ventas_usuario_id_comercio_id_fkey(nombre)",
        )
        .eq("qr_manual", true)
        .eq("estado", "completada")
        .is("revisada_at", null)
        .order("created_at", { ascending: false })
        .limit(VENTAS_A_REVISAR_MAX)
        .overrideTypes<
          Omit<VentaARevisarRow, "avisos_sin_conexion">[],
          { merge: false }
        >(),
      // Con margen, para no avisar de un cobro que el cajero todavía está registrando.
      supabase
        .from("mp_cobros")
        .select("id, created_at, monto, estado")
        .in("estado", ["aprobado", "confirmado_manual", "error"])
        .is("venta_id", null)
        .lt(
          "created_at",
          new Date(ahora - COBRO_SIN_VENTA_MARGEN_MS).toISOString(),
        )
        .gt(
          "created_at",
          new Date(ahora - COBRO_SIN_VENTA_VENTANA_MS).toISOString(),
        )
        .order("created_at", { ascending: false })
        .limit(VENTAS_A_REVISAR_MAX),
    ]);
  if (
    error ||
    aRevisar.error ||
    proximos.error ||
    qrManual.error ||
    cobrosSueltos.error
  )
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
    ventasQrManual: (qrManual.data ?? []).map((v) => ({
      ventaId: v.id,
      fecha: v.created_at,
      total: Number(v.total),
      cajero: v.cajero?.nombre ?? "Otro usuario",
    })),
    cobrosSinVenta: (cobrosSueltos.data ?? []).map((c) => ({
      id: c.id,
      fecha: c.created_at,
      monto: Number(c.monto),
      conError: c.estado === "error",
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
