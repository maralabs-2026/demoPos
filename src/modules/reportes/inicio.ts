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
  const { data, error } = await supabase.rpc("inicio_resumen");
  if (error) return fail("No se pudo armar el inicio.");

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
  });
}
