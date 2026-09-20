"use server";

import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { registrarVentaSchema, type RegistrarVentaInput } from "./schemas";

export type ComprobanteItem = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type Comprobante = {
  items: ComprobanteItem[];
  total: number;
  medioPagoNombre: string;
  vuelto: number | null;
  fecha: string;
};

// TODO(demo): server action simple que descuenta stock producto por producto,
// sin persistir la venta. En Fase 1 la reemplaza la función rpc `registrar_venta`,
// transaccional (cabecera + ítems + pagos + movimientos de stock, o nada).
export async function registrarVentaDemo(
  input: RegistrarVentaInput,
): Promise<ActionResult<Comprobante>> {
  if (!isSupabaseConfigured()) {
    return fail("Falta configurar Supabase en .env.local");
  }

  const parsed = registrarVentaSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos de venta inválidos");
  }
  const { items, medioPagoId, montoRecibido } = parsed.data;

  const supabase = await createClient();

  const productoIds = items.map((i) => i.productoId);
  const { data: productosDb, error: productosError } = await supabase
    .from("productos")
    .select("id, nombre, precio, stock_actual, unidad_venta")
    .in("id", productoIds)
    .overrideTypes<
      {
        id: string;
        nombre: string;
        precio: number;
        stock_actual: number;
        unidad_venta: string;
      }[]
    >();
  if (productosError) return fail(productosError.message);

  const productoPorId = new Map((productosDb ?? []).map((p) => [p.id, p]));
  for (const item of items) {
    const producto = productoPorId.get(item.productoId);
    if (!producto) return fail("Un producto del carrito ya no existe");
    if (producto.stock_actual < item.cantidad) {
      return fail(`Sin stock suficiente de "${producto.nombre}"`);
    }
  }

  const { data: medioPago, error: medioPagoError } = await supabase
    .from("medios_pago")
    .select("id, nombre, tipo")
    .eq("id", medioPagoId)
    .eq("activo", true)
    .maybeSingle();
  if (medioPagoError) return fail(medioPagoError.message);
  if (!medioPago) return fail("Elegí un medio de pago válido");

  // Precios snapshot al momento de vender (sección 3): se toman ahora, antes de descontar stock.
  const comprobanteItems: ComprobanteItem[] = items.map((item) => {
    const producto = productoPorId.get(item.productoId)!;
    const precioUnitario = Number(producto.precio);
    return {
      nombre: producto.nombre,
      cantidad: item.cantidad,
      precioUnitario,
      subtotal: precioUnitario * item.cantidad,
    };
  });
  const total = comprobanteItems.reduce((acc, i) => acc + i.subtotal, 0);

  if (medioPago.tipo === "efectivo") {
    if (montoRecibido === undefined || montoRecibido < total) {
      return fail("El monto recibido es menor al total");
    }
  }

  // Descuento de stock condicional por ítem, con compensación si una carrera deja
  // sin stock suficiente entre el chequeo de arriba y este update (no hay transacción real todavía).
  const aplicados: { productoId: string; cantidad: number }[] = [];
  for (const item of items) {
    const { data: actualizado, error: updateError } = await supabase
      .from("productos")
      .update({
        stock_actual:
          productoPorId.get(item.productoId)!.stock_actual - item.cantidad,
      })
      .eq("id", item.productoId)
      .gte("stock_actual", item.cantidad)
      .select("id")
      .maybeSingle();

    if (updateError || !actualizado) {
      for (const previo of aplicados) {
        const producto = productoPorId.get(previo.productoId)!;
        await supabase
          .from("productos")
          .update({ stock_actual: producto.stock_actual })
          .eq("id", previo.productoId);
      }
      const nombre = productoPorId.get(item.productoId)?.nombre ?? "producto";
      return fail(
        `Se quedó sin stock "${nombre}" justo ahora. Revisá el carrito.`,
      );
    }
    aplicados.push({ productoId: item.productoId, cantidad: item.cantidad });
  }

  const vuelto =
    medioPago.tipo === "efectivo" ? (montoRecibido ?? total) - total : null;

  return ok({
    items: comprobanteItems,
    total,
    medioPagoNombre: medioPago.nombre,
    vuelto,
    fecha: new Date().toISOString(),
  });
}
