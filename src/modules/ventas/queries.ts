import { finDelDia, inicioDelDia } from "@/lib/date";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import type { Comprobante } from "./actions";

export type VentaResumen = {
  id: string;
  fecha: string;
  total: number;
  estado: "completada" | "anulada";
  cajero: string;
  medios: string;
};

type Persona = { nombre: string } | null;
type PagoRow = { medios_pago: { nombre: string; tipo: string } | null };

type VentaResumenRow = {
  id: string;
  created_at: string;
  total: number;
  estado: VentaResumen["estado"];
  cajero: Persona;
  venta_pagos: PagoRow[];
};

const CAJERO = "cajero:perfiles!ventas_usuario_id_comercio_id_fkey(nombre)";
const POR_PAGINA = 50;

function nombresDeMedios(pagos: PagoRow[]): string {
  return pagos
    .map((p) => p.medios_pago?.nombre)
    .filter(Boolean)
    .join(" + ");
}

// Ventas de un período, de la más nueva a la más vieja. La RLS limita al comercio.
export async function getVentas(filtros: {
  desde: string;
  hasta: string;
  pagina: number;
}): Promise<ActionResult<{ ventas: VentaResumen[]; hayMas: boolean }>> {
  const supabase = await createClient();
  const inicio = filtros.pagina * POR_PAGINA;
  // Una de más para saber si hay otra página, sin contar todas las filas.
  const { data, error } = await supabase
    .from("ventas")
    .select(
      `id, created_at, total, estado, ${CAJERO}, venta_pagos(medios_pago(nombre, tipo))`,
    )
    .gte("created_at", inicioDelDia(filtros.desde))
    .lt("created_at", finDelDia(filtros.hasta))
    .order("created_at", { ascending: false })
    .range(inicio, inicio + POR_PAGINA)
    .overrideTypes<VentaResumenRow[]>();

  if (error) return fail("No se pudieron leer las ventas.");
  return ok({
    ventas: data.slice(0, POR_PAGINA).map((v) => ({
      id: v.id,
      fecha: v.created_at,
      total: Number(v.total),
      estado: v.estado,
      cajero: v.cajero?.nombre ?? "Otro usuario",
      medios: nombresDeMedios(v.venta_pagos),
    })),
    hayMas: data.length > POR_PAGINA,
  });
}

export type VentaDetalle = {
  comprobante: Comprobante;
  estado: VentaResumen["estado"];
  cajero: string;
  anulacion: { fecha: string; por: string; motivo: string } | null;
};

type VentaDetalleRow = {
  id: string;
  created_at: string;
  total: number;
  descuento: number;
  estado: VentaResumen["estado"];
  anulada_at: string | null;
  motivo_anulacion: string | null;
  cajero: Persona;
  anulador: Persona;
  venta_items: {
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    descuento: number;
    promocion_nombre: string | null;
    subtotal: number;
  }[];
  venta_pagos: (PagoRow & { vuelto: number })[];
};

// Reimprimir sale de lo que guardó la venta (snapshot), no del producto de hoy.
export async function getVenta(
  id: string,
): Promise<ActionResult<VentaDetalle | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventas")
    .select(
      `id, created_at, total, descuento, estado, anulada_at, motivo_anulacion, ${CAJERO},
       anulador:perfiles!ventas_anulada_por_comercio_fkey(nombre),
       venta_items(nombre, cantidad, precio_unitario, descuento, promocion_nombre, subtotal),
       venta_pagos(vuelto, medios_pago(nombre, tipo))`,
    )
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<VentaDetalleRow>();

  if (error) return fail("No se pudo leer la venta.");
  if (!data) return ok(null);

  const hayEfectivo = data.venta_pagos.some(
    (p) => p.medios_pago?.tipo === "efectivo",
  );
  return ok({
    comprobante: {
      ventaId: data.id,
      items: data.venta_items.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        precioUnitario: Number(i.precio_unitario),
        descuento: Number(i.descuento),
        promocion: i.promocion_nombre,
        subtotal: Number(i.subtotal),
      })),
      total: Number(data.total),
      descuentoTotal: Number(data.descuento),
      medioPagoNombre: nombresDeMedios(data.venta_pagos),
      vuelto: hayEfectivo
        ? data.venta_pagos.reduce((acc, p) => acc + Number(p.vuelto), 0)
        : null,
      fecha: data.created_at,
    },
    estado: data.estado,
    cajero: data.cajero?.nombre ?? "Otro usuario",
    anulacion: data.anulada_at
      ? {
          fecha: data.anulada_at,
          por: data.anulador?.nombre ?? "Otro usuario",
          motivo: data.motivo_anulacion ?? "",
        }
      : null,
  });
}
