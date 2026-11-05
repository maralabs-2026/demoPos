import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function getComercioName(): Promise<ActionResult<string>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comercios")
    .select("nombre")
    .limit(1)
    .maybeSingle();

  if (error) return fail(error.message);
  if (!data) return fail("No hay ningún comercio cargado");
  return ok(data.nombre as string);
}

export type MedioPago = {
  id: string;
  nombre: string;
  tipo: "efectivo" | "tarjeta" | "transferencia" | "qr" | "cuenta_corriente";
};

export async function getMediosPago(): Promise<ActionResult<MedioPago[]>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medios_pago")
    .select("id, nombre, tipo")
    .eq("activo", true)
    .order("orden", { ascending: true })
    .overrideTypes<MedioPago[]>();

  if (error) return fail(error.message);
  return ok(data ?? []);
}

export type TicketConfig = { titulo: string; leyenda: string; pie: string };

// Textos del ticket (clave ticket, 0021). Sin configuración, el ticket sale solo con los datos de la
// venta: nunca con textos escritos en el código.
export async function getTicketConfig(): Promise<ActionResult<TicketConfig>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", "ticket")
    .maybeSingle()
    .overrideTypes<{ valor: Partial<TicketConfig> }>();

  if (error) return fail("No se pudieron leer los datos del ticket.");
  return ok({
    titulo: data?.valor.titulo ?? "",
    leyenda: data?.valor.leyenda ?? "",
    pie: data?.valor.pie ?? "",
  });
}

const DESCUENTO_MAX_CAJERO_DEFAULT = 10;

// Tope de descuento del cajero, en % (clave descuento_max_cajero_pct, 0012). Sin la clave, 10.
export async function getDescuentoMaxCajeroPct(): Promise<
  ActionResult<number>
> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", "descuento_max_cajero_pct")
    .maybeSingle();

  if (error) return fail("No se pudo leer la configuración de descuentos.");
  const valor = Number(data?.valor);
  return ok(Number.isFinite(valor) ? valor : DESCUENTO_MAX_CAJERO_DEFAULT);
}
