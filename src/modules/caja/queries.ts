import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { LineaCierre } from "./cierre";
import { hrefDeCaja } from "./gastos";

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

export type MovimientoCaja = {
  id: string;
  tipo: "retiro" | "ingreso";
  monto: number;
  motivo: string;
  createdAt: string;
  // El cajero no puede leer el perfil de otro: si lo cargó el dueño, llega sin nombre.
  autor: string;
};

type MovimientoRow = {
  id: string;
  tipo: "retiro" | "ingreso";
  monto: number;
  motivo: string;
  created_at: string;
  autor: Persona;
};

// Los retiros e ingresos de una caja, del más nuevo al más viejo. Muestran solo lo cargado, nunca
// el esperado: el conteo sigue siendo a ciegas.
export async function getMovimientosCaja(
  cajaId: string,
): Promise<ActionResult<MovimientoCaja[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("caja_movimientos")
    .select(
      "id, tipo, monto, motivo, created_at, autor:perfiles!caja_movimientos_usuario_id_comercio_id_fkey(nombre)",
    )
    .eq("caja_id", cajaId)
    .order("created_at", { ascending: false })
    .overrideTypes<MovimientoRow[]>();

  if (error) return fail("No se pudieron leer los retiros e ingresos.");
  return ok(
    data.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      monto: Number(m.monto),
      motivo: m.motivo,
      createdAt: m.created_at,
      autor: m.autor?.nombre ?? "Otro usuario",
    })),
  );
}

export type Gasto = {
  id: string;
  descripcion: string;
  tipo: "fijo" | "variable" | "mercaderia";
  monto: number;
  vencimiento: string | null;
  estado: "por_pagar" | "pagado" | "anulado";
  pagadoAt: string | null;
  // Solo si salió de una caja.
  cajaId: string | null;
  cajaHref: string | null;
};

type GastoRow = {
  id: string;
  descripcion: string;
  tipo: Gasto["tipo"];
  monto: number;
  vencimiento: string | null;
  estado: Gasto["estado"];
  pagado_at: string | null;
  caja_id: string | null;
  caja: {
    id: string;
    estado: "abierta" | "cerrada";
    usuario_id: string;
  } | null;
};

const GASTOS_RESUELTOS_LIMITE = 50;
const SELECT_GASTO =
  "id, descripcion, tipo, monto, vencimiento, estado, pagado_at, caja_id, caja:cajas!gastos_caja_id_comercio_id_fkey(id, estado, usuario_id)";

function aGasto(row: GastoRow, usuarioId: string): Gasto {
  return {
    id: row.id,
    descripcion: row.descripcion,
    tipo: row.tipo,
    monto: Number(row.monto),
    vencimiento: row.vencimiento,
    estado: row.estado,
    pagadoAt: row.pagado_at,
    cajaId: row.caja_id,
    cajaHref: row.caja
      ? hrefDeCaja(
          {
            id: row.caja.id,
            estado: row.caja.estado,
            usuarioId: row.caja.usuario_id,
          },
          usuarioId,
        )
      : null,
  };
}

// Todos los gastos por pagar, los que vencen antes primero, y los últimos pagados o anulados.
export async function getGastos(): Promise<
  ActionResult<{ porPagar: Gasto[]; resueltos: Gasto[] }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Tu sesión venció. Volvé a ingresar.");

  const [porPagar, resueltos] = await Promise.all([
    supabase
      .from("gastos")
      .select(SELECT_GASTO)
      .eq("estado", "por_pagar")
      .order("vencimiento", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .overrideTypes<GastoRow[]>(),
    supabase
      .from("gastos")
      .select(SELECT_GASTO)
      .neq("estado", "por_pagar")
      .order("created_at", { ascending: false })
      .limit(GASTOS_RESUELTOS_LIMITE)
      .overrideTypes<GastoRow[]>(),
  ]);

  if (porPagar.error || resueltos.error) {
    return fail("No se pudieron leer los gastos.");
  }
  return ok({
    porPagar: porPagar.data.map((row) => aGasto(row, user.id)),
    resueltos: resueltos.data.map((row) => aGasto(row, user.id)),
  });
}

export type CajaParaPagar = { id: string; nombre: string };

// Las cajas abiertas de las que puede salir un gasto: la propia primero.
export async function getCajasParaPagar(): Promise<
  ActionResult<CajaParaPagar[]>
> {
  const [propia, otras] = await Promise.all([
    getCajaAbierta(),
    getCajasAbiertasDeOtros(),
  ]);
  if (!propia.ok) return propia;
  if (!otras.ok) return otras;

  return ok([
    ...(propia.data ? [{ id: propia.data.id, nombre: "Mi caja" }] : []),
    ...otras.data.map((c) => ({ id: c.id, nombre: `Caja de ${c.titular}` })),
  ]);
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
