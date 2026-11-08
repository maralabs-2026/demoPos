import type { Database as Generated } from "./database.types";

export type { Json, Tables } from "./database.types";

// `supabase gen types` declara todos los argumentos de una función como no nulos, aunque la función
// acepte null. Acá se corrigen solo los que la app manda en null a propósito: el resto del esquema
// queda exactamente como lo genera la CLI.
type ConNulos<Fn extends { Args: object }, K extends keyof Fn["Args"]> = Omit<
  Fn,
  "Args"
> & {
  Args: {
    [P in keyof Fn["Args"]]: P extends K ? Fn["Args"][P] | null : Fn["Args"][P];
  };
};

type Fns = Generated["public"]["Functions"];

type FuncionesConNulos = {
  // Sin monto pagado cuando la orden se cancela o vence.
  aplicar_estado_mp_cobro: ConNulos<
    Fns["aplicar_estado_mp_cobro"],
    "p_monto_pagado"
  >;
  // Sin vencimiento; sin caja cuando se paga por fuera.
  registrar_gasto: ConNulos<
    Fns["registrar_gasto"],
    "p_vencimiento" | "p_caja_id"
  >;
  pagar_gasto: ConNulos<Fns["pagar_gasto"], "p_caja_id">;
  // Sin categoría: todo el catálogo.
  actualizar_precios: ConNulos<Fns["actualizar_precios"], "p_categoria_id">;
  // Sin id: alta. Sin categoría o sin costo cargado.
  guardar_producto: ConNulos<
    Fns["guardar_producto"],
    | "p_id"
    | "p_categoria_id"
    | "p_costo"
    | "p_precio_anterior"
    | "p_costo_anterior"
    | "p_proveedor_id"
  >;
  // Sin usuario: todos los cajeros.
  reporte_ventas: ConNulos<Fns["reporte_ventas"], "p_usuario_id">;
  // Sin categoría: los productos sin categoría.
  aplicar_auditoria_stock: ConNulos<
    Fns["aplicar_auditoria_stock"],
    "p_categoria_id"
  >;
};

export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Functions"> & {
    Functions: Omit<Fns, keyof FuncionesConNulos> & FuncionesConNulos;
  };
};
