import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { LineaCierre } from "./cierre";

export type CajaAbierta = {
  id: string;
  montoInicial: number;
  abiertaAt: string;
};

type CajaRow = { id: string; monto_inicial: number; abierta_at: string };

// La caja abierta del usuario de la sesión, o null si no tiene. Dueño y encargado ven todas las
// cajas por RLS, así que se filtra explícitamente por el usuario.
export async function getCajaAbierta(): Promise<
  ActionResult<CajaAbierta | null>
> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Volvé a ingresar.");

  const { data, error } = await supabase
    .from("cajas")
    .select("id, monto_inicial, abierta_at")
    .eq("usuario_id", user.id)
    .eq("estado", "abierta")
    .maybeSingle()
    .overrideTypes<CajaRow>();

  if (error) return fail("No se pudo leer el estado de tu caja.");
  if (!data) return ok(null);

  return ok({
    id: data.id,
    montoInicial: Number(data.monto_inicial),
    abiertaAt: data.abierta_at,
  });
}

export type MedioAContar = { id: string; nombre: string };

// Qué hay que contar, sin montos: el cierre es a ciegas.
export async function getMediosAContar(
  cajaId: string,
): Promise<ActionResult<MedioAContar[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("caja_medios_a_contar", {
    p_caja_id: cajaId,
  });

  if (error) return fail("No se pudo leer qué hay que contar en esta caja.");
  const medios = (data ?? []) as { medio_pago_id: string; nombre: string }[];
  return ok(medios.map((m) => ({ id: m.medio_pago_id, nombre: m.nombre })));
}

export type CajaDeOtro = CajaAbierta & { titular: string };

// El nombre de otro usuario: la RLS de perfiles se lo muestra a dueño y encargado, no al cajero.
const TITULAR = "titular:perfiles!cajas_usuario_id_comercio_id_fkey(nombre)";
const CERRADA_POR = "cerrador:perfiles!cajas_cerrada_por_comercio_fkey(nombre)";

type Persona = { nombre: string } | null;

// Una caja abierta de cualquier usuario, si la RLS deja verla. Para cerrar la que otro dejó abierta.
export async function getCajaAbiertaPorId(
  cajaId: string,
): Promise<ActionResult<CajaDeOtro | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cajas")
    .select(`id, monto_inicial, abierta_at, ${TITULAR}`)
    .eq("id", cajaId)
    .eq("estado", "abierta")
    .maybeSingle()
    .overrideTypes<CajaRow & { titular: Persona }>();

  if (error) return fail("No se pudo leer la caja.");
  if (!data) return ok(null);
  return ok({
    id: data.id,
    montoInicial: Number(data.monto_inicial),
    abiertaAt: data.abierta_at,
    titular: data.titular?.nombre ?? "Otro usuario",
  });
}

// Las cajas abiertas de los demás. Solo tiene resultados para dueño y encargado (RLS de cajas).
export async function getCajasAbiertasDeOtros(): Promise<
  ActionResult<CajaDeOtro[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Volvé a ingresar.");

  const { data, error } = await supabase
    .from("cajas")
    .select(`id, monto_inicial, abierta_at, ${TITULAR}`)
    .eq("estado", "abierta")
    .neq("usuario_id", user.id)
    .order("abierta_at")
    .overrideTypes<(CajaRow & { titular: Persona })[]>();

  if (error) return fail("No se pudieron leer las cajas abiertas.");
  return ok(
    data.map((c) => ({
      id: c.id,
      montoInicial: Number(c.monto_inicial),
      abiertaAt: c.abierta_at,
      titular: c.titular?.nombre ?? "Otro usuario",
    })),
  );
}

export type CajaCerrada = {
  id: string;
  montoInicial: number;
  abiertaAt: string;
  cerradaAt: string;
  titular: string;
  cerradaPor: string | null;
  nota: string | null;
  lineas: LineaCierre[];
};

type LineaRow = {
  medio_pago_id: string;
  nombre: string;
  esperado: number;
  contado: number;
  diferencia: number;
};

type CajaCerradaRow = CajaRow & {
  cerrada_at: string;
  nota_cierre: string | null;
  titular: Persona;
  cerrador: Persona;
  caja_cierres: LineaRow[];
};

const SELECT_CERRADA = `id, monto_inicial, abierta_at, cerrada_at, nota_cierre, ${TITULAR}, ${CERRADA_POR},
  caja_cierres(medio_pago_id, nombre, esperado, contado, diferencia)`;

function aCajaCerrada(row: CajaCerradaRow): CajaCerrada {
  return {
    id: row.id,
    montoInicial: Number(row.monto_inicial),
    abiertaAt: row.abierta_at,
    cerradaAt: row.cerrada_at,
    titular: row.titular?.nombre ?? "Otro usuario",
    cerradaPor: row.cerrador?.nombre ?? null,
    nota: row.nota_cierre,
    lineas: row.caja_cierres
      .map((l) => ({
        medioPagoId: l.medio_pago_id,
        nombre: l.nombre,
        esperado: Number(l.esperado),
        contado: Number(l.contado),
        diferencia: Number(l.diferencia),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}

const HISTORIAL_LIMITE = 50;

// Últimos cierres que el usuario puede ver: el cajero, los suyos; dueño y encargado, todos.
export async function getHistorialCajas(): Promise<
  ActionResult<CajaCerrada[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cajas")
    .select(SELECT_CERRADA)
    .eq("estado", "cerrada")
    .order("cerrada_at", { ascending: false })
    .limit(HISTORIAL_LIMITE)
    .overrideTypes<CajaCerradaRow[]>();

  if (error) return fail("No se pudo leer el historial de cajas.");
  return ok(data.map(aCajaCerrada));
}

export async function getCajaCerrada(
  cajaId: string,
): Promise<ActionResult<CajaCerrada | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cajas")
    .select(SELECT_CERRADA)
    .eq("id", cajaId)
    .eq("estado", "cerrada")
    .maybeSingle()
    .overrideTypes<CajaCerradaRow>();

  if (error) return fail("No se pudo leer el cierre.");
  return ok(data ? aCajaCerrada(data) : null);
}
