// Generado con `supabase gen types typescript --linked --schema public` desde kiosko-demo-test.
// No editar a mano: regenerar después de cada migración (ver README).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      caja_cierres: {
        Row: {
          caja_id: string;
          comercio_id: string;
          contado: number;
          diferencia: number | null;
          esperado: number;
          medio_pago_id: string;
          nombre: string;
        };
        Insert: {
          caja_id: string;
          comercio_id: string;
          contado: number;
          diferencia?: number | null;
          esperado: number;
          medio_pago_id: string;
          nombre: string;
        };
        Update: {
          caja_id?: string;
          comercio_id?: string;
          contado?: number;
          diferencia?: number | null;
          esperado?: number;
          medio_pago_id?: string;
          nombre?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caja_cierres_caja_id_comercio_id_fkey";
            columns: ["caja_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "cajas";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "caja_cierres_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caja_cierres_medio_pago_id_comercio_id_fkey";
            columns: ["medio_pago_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "medios_pago";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      caja_movimientos: {
        Row: {
          caja_id: string;
          comercio_id: string;
          created_at: string;
          id: string;
          monto: number;
          motivo: string;
          tipo: string;
          usuario_id: string;
          venta_id: string | null;
        };
        Insert: {
          caja_id: string;
          comercio_id: string;
          created_at?: string;
          id?: string;
          monto: number;
          motivo: string;
          tipo: string;
          usuario_id: string;
          venta_id?: string | null;
        };
        Update: {
          caja_id?: string;
          comercio_id?: string;
          created_at?: string;
          id?: string;
          monto?: number;
          motivo?: string;
          tipo?: string;
          usuario_id?: string;
          venta_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "caja_movimientos_caja_id_comercio_id_fkey";
            columns: ["caja_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "cajas";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "caja_movimientos_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caja_movimientos_usuario_id_comercio_id_fkey";
            columns: ["usuario_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "caja_movimientos_venta_comercio_fkey";
            columns: ["venta_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      cajas: {
        Row: {
          abierta_at: string;
          cerrada_at: string | null;
          cerrada_por: string | null;
          comercio_id: string;
          estado: string;
          id: string;
          monto_inicial: number;
          nota_cierre: string | null;
          usuario_id: string;
        };
        Insert: {
          abierta_at?: string;
          cerrada_at?: string | null;
          cerrada_por?: string | null;
          comercio_id: string;
          estado?: string;
          id?: string;
          monto_inicial?: number;
          nota_cierre?: string | null;
          usuario_id: string;
        };
        Update: {
          abierta_at?: string;
          cerrada_at?: string | null;
          cerrada_por?: string | null;
          comercio_id?: string;
          estado?: string;
          id?: string;
          monto_inicial?: number;
          nota_cierre?: string | null;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cajas_cerrada_por_comercio_fkey";
            columns: ["cerrada_por", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "cajas_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cajas_usuario_id_comercio_id_fkey";
            columns: ["usuario_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      categorias: {
        Row: {
          comercio_id: string;
          created_at: string;
          id: string;
          nombre: string;
          orden: number;
        };
        Insert: {
          comercio_id: string;
          created_at?: string;
          id?: string;
          nombre: string;
          orden?: number;
        };
        Update: {
          comercio_id?: string;
          created_at?: string;
          id?: string;
          nombre?: string;
          orden?: number;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
        ];
      };
      combo_items: {
        Row: {
          cantidad: number;
          combo_id: string;
          comercio_id: string;
          producto_id: string;
        };
        Insert: {
          cantidad: number;
          combo_id: string;
          comercio_id: string;
          producto_id: string;
        };
        Update: {
          cantidad?: number;
          combo_id?: string;
          comercio_id?: string;
          producto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_comercio_id_fkey";
            columns: ["combo_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "combos";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "combo_items_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "combo_items_producto_id_comercio_id_fkey";
            columns: ["producto_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      combos: {
        Row: {
          activa: boolean;
          comercio_id: string;
          created_at: string;
          desde: string;
          dias: number[];
          hasta: string;
          id: string;
          nombre: string;
          precio: number;
        };
        Insert: {
          activa?: boolean;
          comercio_id: string;
          created_at?: string;
          desde?: string;
          dias?: number[];
          hasta?: string;
          id?: string;
          nombre: string;
          precio: number;
        };
        Update: {
          activa?: boolean;
          comercio_id?: string;
          created_at?: string;
          desde?: string;
          dias?: number[];
          hasta?: string;
          id?: string;
          nombre?: string;
          precio?: number;
        };
        Relationships: [
          {
            foreignKeyName: "combos_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
        ];
      };
      comercios: {
        Row: {
          created_at: string;
          id: string;
          logo_path: string | null;
          nombre: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          nombre: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          nombre?: string;
        };
        Relationships: [];
      };
      compra_items: {
        Row: {
          bonificacion_pct: number;
          cantidad: number;
          comercio_id: string;
          compra_id: string;
          costo_lista: number;
          costo_unitario: number;
          id: string;
          nombre: string;
          producto_id: string;
          subtotal: number;
          vencimiento: string | null;
        };
        Insert: {
          bonificacion_pct: number;
          cantidad: number;
          comercio_id: string;
          compra_id: string;
          costo_lista: number;
          costo_unitario: number;
          id?: string;
          nombre: string;
          producto_id: string;
          subtotal: number;
          vencimiento?: string | null;
        };
        Update: {
          bonificacion_pct?: number;
          cantidad?: number;
          comercio_id?: string;
          compra_id?: string;
          costo_lista?: number;
          costo_unitario?: number;
          id?: string;
          nombre?: string;
          producto_id?: string;
          subtotal?: number;
          vencimiento?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "compra_items_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compra_items_compra_id_comercio_id_fkey";
            columns: ["compra_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "compras";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "compra_items_producto_id_comercio_id_fkey";
            columns: ["producto_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      compras: {
        Row: {
          comercio_id: string;
          comprobante: string | null;
          created_at: string;
          gasto_id: string;
          id: string;
          proveedor_id: string;
          total: number;
          usuario_id: string;
        };
        Insert: {
          comercio_id: string;
          comprobante?: string | null;
          created_at?: string;
          gasto_id: string;
          id?: string;
          proveedor_id: string;
          total: number;
          usuario_id: string;
        };
        Update: {
          comercio_id?: string;
          comprobante?: string | null;
          created_at?: string;
          gasto_id?: string;
          id?: string;
          proveedor_id?: string;
          total?: number;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compras_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compras_gasto_id_fkey";
            columns: ["gasto_id"];
            isOneToOne: false;
            referencedRelation: "gastos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compras_proveedor_id_comercio_id_fkey";
            columns: ["proveedor_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "proveedores";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "compras_usuario_id_comercio_id_fkey";
            columns: ["usuario_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      configuracion: {
        Row: {
          clave: string;
          comercio_id: string;
          created_at: string;
          id: string;
          updated_at: string;
          valor: Json;
        };
        Insert: {
          clave: string;
          comercio_id: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          valor: Json;
        };
        Update: {
          clave?: string;
          comercio_id?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          valor?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "configuracion_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
        ];
      };
      gastos: {
        Row: {
          anulado_at: string | null;
          anulado_por: string | null;
          caja_id: string | null;
          caja_movimiento_id: string | null;
          comercio_id: string;
          created_at: string;
          descripcion: string;
          estado: string;
          id: string;
          monto: number;
          pagado_at: string | null;
          pagado_por: string | null;
          tipo: string;
          usuario_id: string;
          vencimiento: string | null;
        };
        Insert: {
          anulado_at?: string | null;
          anulado_por?: string | null;
          caja_id?: string | null;
          caja_movimiento_id?: string | null;
          comercio_id: string;
          created_at?: string;
          descripcion: string;
          estado?: string;
          id?: string;
          monto: number;
          pagado_at?: string | null;
          pagado_por?: string | null;
          tipo: string;
          usuario_id: string;
          vencimiento?: string | null;
        };
        Update: {
          anulado_at?: string | null;
          anulado_por?: string | null;
          caja_id?: string | null;
          caja_movimiento_id?: string | null;
          comercio_id?: string;
          created_at?: string;
          descripcion?: string;
          estado?: string;
          id?: string;
          monto?: number;
          pagado_at?: string | null;
          pagado_por?: string | null;
          tipo?: string;
          usuario_id?: string;
          vencimiento?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gastos_anulado_por_comercio_id_fkey";
            columns: ["anulado_por", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "gastos_caja_id_comercio_id_fkey";
            columns: ["caja_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "cajas";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "gastos_caja_movimiento_id_fkey";
            columns: ["caja_movimiento_id"];
            isOneToOne: false;
            referencedRelation: "caja_movimientos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gastos_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gastos_pagado_por_comercio_id_fkey";
            columns: ["pagado_por", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "gastos_usuario_id_comercio_id_fkey";
            columns: ["usuario_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      medios_pago: {
        Row: {
          activo: boolean;
          comercio_id: string;
          created_at: string;
          id: string;
          nombre: string;
          orden: number;
          tipo: string;
        };
        Insert: {
          activo?: boolean;
          comercio_id: string;
          created_at?: string;
          id?: string;
          nombre: string;
          orden?: number;
          tipo: string;
        };
        Update: {
          activo?: boolean;
          comercio_id?: string;
          created_at?: string;
          id?: string;
          nombre?: string;
          orden?: number;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "medios_pago_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
        ];
      };
      movimientos_stock: {
        Row: {
          cantidad: number;
          comercio_id: string;
          created_at: string;
          id: string;
          motivo: string | null;
          producto_id: string;
          tipo: string;
          usuario_id: string | null;
          vencimiento: string | null;
          venta_id: string | null;
        };
        Insert: {
          cantidad: number;
          comercio_id: string;
          created_at?: string;
          id?: string;
          motivo?: string | null;
          producto_id: string;
          tipo: string;
          usuario_id?: string | null;
          vencimiento?: string | null;
          venta_id?: string | null;
        };
        Update: {
          cantidad?: number;
          comercio_id?: string;
          created_at?: string;
          id?: string;
          motivo?: string | null;
          producto_id?: string;
          tipo?: string;
          usuario_id?: string | null;
          vencimiento?: string | null;
          venta_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_stock_producto_id_comercio_id_fkey";
            columns: ["producto_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "movimientos_stock_usuario_id_comercio_id_fkey";
            columns: ["usuario_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "movimientos_stock_venta_fkey";
            columns: ["venta_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      perfiles: {
        Row: {
          activo: boolean;
          comercio_id: string;
          created_at: string;
          id: string;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
        };
        Insert: {
          activo?: boolean;
          comercio_id: string;
          created_at?: string;
          id: string;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
        };
        Update: {
          activo?: boolean;
          comercio_id?: string;
          created_at?: string;
          id?: string;
          nombre?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
        };
        Relationships: [
          {
            foreignKeyName: "perfiles_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
        ];
      };
      productos: {
        Row: {
          categoria_id: string | null;
          codigo_barras: string;
          comercio_id: string;
          controla_stock: boolean;
          created_at: string;
          foto_path: string | null;
          id: string;
          nombre: string;
          precio: number;
          precio_libre: boolean;
          proveedor_id: string | null;
          stock_actual: number;
          stock_minimo: number;
          unidad_venta: string;
        };
        Insert: {
          categoria_id?: string | null;
          codigo_barras: string;
          comercio_id: string;
          controla_stock?: boolean;
          created_at?: string;
          foto_path?: string | null;
          id?: string;
          nombre: string;
          precio: number;
          precio_libre?: boolean;
          proveedor_id?: string | null;
          stock_actual?: number;
          stock_minimo?: number;
          unidad_venta?: string;
        };
        Update: {
          categoria_id?: string | null;
          codigo_barras?: string;
          comercio_id?: string;
          controla_stock?: boolean;
          created_at?: string;
          foto_path?: string | null;
          id?: string;
          nombre?: string;
          precio?: number;
          precio_libre?: boolean;
          proveedor_id?: string | null;
          stock_actual?: number;
          stock_minimo?: number;
          unidad_venta?: string;
        };
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "productos_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "productos_proveedor_comercio_fkey";
            columns: ["proveedor_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "proveedores";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      productos_costos: {
        Row: {
          comercio_id: string;
          costo: number;
          producto_id: string;
          updated_at: string;
        };
        Insert: {
          comercio_id: string;
          costo: number;
          producto_id: string;
          updated_at?: string;
        };
        Update: {
          comercio_id?: string;
          costo?: number;
          producto_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "productos_costos_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "productos_costos_producto_id_comercio_id_fkey";
            columns: ["producto_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      promociones: {
        Row: {
          activa: boolean;
          alcance: string;
          cantidad: number | null;
          categoria_id: string | null;
          comercio_id: string;
          created_at: string;
          desde: string;
          dias: number[];
          hasta: string;
          id: string;
          lleva: number | null;
          nombre: string;
          paga: number | null;
          porcentaje: number | null;
          precio: number | null;
          producto_id: string | null;
          tipo: string;
        };
        Insert: {
          activa?: boolean;
          alcance: string;
          cantidad?: number | null;
          categoria_id?: string | null;
          comercio_id: string;
          created_at?: string;
          desde?: string;
          dias?: number[];
          hasta?: string;
          id?: string;
          lleva?: number | null;
          nombre: string;
          paga?: number | null;
          porcentaje?: number | null;
          precio?: number | null;
          producto_id?: string | null;
          tipo: string;
        };
        Update: {
          activa?: boolean;
          alcance?: string;
          cantidad?: number | null;
          categoria_id?: string | null;
          comercio_id?: string;
          created_at?: string;
          desde?: string;
          dias?: number[];
          hasta?: string;
          id?: string;
          lleva?: number | null;
          nombre?: string;
          paga?: number | null;
          porcentaje?: number | null;
          precio?: number | null;
          producto_id?: string | null;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promociones_categoria_id_comercio_id_fkey";
            columns: ["categoria_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "promociones_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promociones_producto_id_comercio_id_fkey";
            columns: ["producto_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      proveedores: {
        Row: {
          activo: boolean;
          comercio_id: string;
          created_at: string;
          id: string;
          nombre: string;
          nota: string | null;
          telefono: string | null;
          updated_at: string;
        };
        Insert: {
          activo?: boolean;
          comercio_id: string;
          created_at?: string;
          id?: string;
          nombre: string;
          nota?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          comercio_id?: string;
          created_at?: string;
          id?: string;
          nombre?: string;
          nota?: string | null;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proveedores_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
        ];
      };
      venta_items: {
        Row: {
          cantidad: number;
          comercio_id: string;
          descuento: number;
          id: string;
          nombre: string;
          precio_unitario: number;
          producto_id: string;
          promocion_descuento: number;
          promocion_nombre: string | null;
          subtotal: number;
          venta_id: string;
        };
        Insert: {
          cantidad: number;
          comercio_id: string;
          descuento?: number;
          id?: string;
          nombre: string;
          precio_unitario: number;
          producto_id: string;
          promocion_descuento?: number;
          promocion_nombre?: string | null;
          subtotal: number;
          venta_id: string;
        };
        Update: {
          cantidad?: number;
          comercio_id?: string;
          descuento?: number;
          id?: string;
          nombre?: string;
          precio_unitario?: number;
          producto_id?: string;
          promocion_descuento?: number;
          promocion_nombre?: string | null;
          subtotal?: number;
          venta_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venta_items_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_items_producto_id_comercio_id_fkey";
            columns: ["producto_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "venta_items_venta_id_comercio_id_fkey";
            columns: ["venta_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      venta_items_costos: {
        Row: {
          comercio_id: string;
          costo: number;
          venta_item_id: string;
        };
        Insert: {
          comercio_id: string;
          costo: number;
          venta_item_id: string;
        };
        Update: {
          comercio_id?: string;
          costo?: number;
          venta_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venta_items_costos_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_items_costos_venta_item_id_comercio_id_fkey";
            columns: ["venta_item_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "venta_items";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      venta_pagos: {
        Row: {
          comercio_id: string;
          id: string;
          medio_pago_id: string;
          monto: number;
          recibido: number | null;
          referencia_externa: string | null;
          venta_id: string;
          vuelto: number;
        };
        Insert: {
          comercio_id: string;
          id?: string;
          medio_pago_id: string;
          monto: number;
          recibido?: number | null;
          referencia_externa?: string | null;
          venta_id: string;
          vuelto?: number;
        };
        Update: {
          comercio_id?: string;
          id?: string;
          medio_pago_id?: string;
          monto?: number;
          recibido?: number | null;
          referencia_externa?: string | null;
          venta_id?: string;
          vuelto?: number;
        };
        Relationships: [
          {
            foreignKeyName: "venta_pagos_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_pagos_medio_pago_id_comercio_id_fkey";
            columns: ["medio_pago_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "medios_pago";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "venta_pagos_venta_id_comercio_id_fkey";
            columns: ["venta_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
      ventas: {
        Row: {
          anulada_at: string | null;
          anulada_por: string | null;
          avisos_sin_conexion: string[];
          caja_id: string;
          cliente_id: string | null;
          comercio_id: string;
          comprobante_fiscal_id: string | null;
          created_at: string;
          descuento: number;
          estado: string;
          id: string;
          motivo_anulacion: string | null;
          revisada_at: string | null;
          revisada_por: string | null;
          sin_conexion: boolean;
          sincronizada_at: string | null;
          total: number;
          usuario_id: string;
        };
        Insert: {
          anulada_at?: string | null;
          anulada_por?: string | null;
          avisos_sin_conexion?: string[];
          caja_id: string;
          cliente_id?: string | null;
          comercio_id: string;
          comprobante_fiscal_id?: string | null;
          created_at?: string;
          descuento?: number;
          estado?: string;
          id?: string;
          motivo_anulacion?: string | null;
          revisada_at?: string | null;
          revisada_por?: string | null;
          sin_conexion?: boolean;
          sincronizada_at?: string | null;
          total: number;
          usuario_id: string;
        };
        Update: {
          anulada_at?: string | null;
          anulada_por?: string | null;
          avisos_sin_conexion?: string[];
          caja_id?: string;
          cliente_id?: string | null;
          comercio_id?: string;
          comprobante_fiscal_id?: string | null;
          created_at?: string;
          descuento?: number;
          estado?: string;
          id?: string;
          motivo_anulacion?: string | null;
          revisada_at?: string | null;
          revisada_por?: string | null;
          sin_conexion?: boolean;
          sincronizada_at?: string | null;
          total?: number;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ventas_anulada_por_comercio_fkey";
            columns: ["anulada_por", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "ventas_caja_id_comercio_id_fkey";
            columns: ["caja_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "cajas";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "ventas_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ventas_revisada_por_comercio_fkey";
            columns: ["revisada_por", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "ventas_usuario_id_comercio_id_fkey";
            columns: ["usuario_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "perfiles";
            referencedColumns: ["id", "comercio_id"];
          },
        ];
      };
    };
    Views: {
      caja_totales: {
        Row: {
          caja_id: string | null;
          comercio_id: string | null;
          medio_pago_id: string | null;
          total: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ventas_caja_id_comercio_id_fkey";
            columns: ["caja_id", "comercio_id"];
            isOneToOne: false;
            referencedRelation: "cajas";
            referencedColumns: ["id", "comercio_id"];
          },
          {
            foreignKeyName: "ventas_comercio_id_fkey";
            columns: ["comercio_id"];
            isOneToOne: false;
            referencedRelation: "comercios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      actualizar_precios: {
        Args: { p_categoria_id: string; p_porcentaje: number };
        Returns: number;
      };
      anular_gasto: { Args: { p_gasto_id: string }; Returns: boolean };
      anular_venta: {
        Args: { p_motivo: string; p_venta_id: string };
        Returns: Json;
      };
      aplicar_auditoria_stock: {
        Args: { p_categoria_id: string; p_conteos: Json };
        Returns: Json;
      };
      caja_esperado_por_medio: {
        Args: { p_caja_id: string };
        Returns: {
          esperado: number;
          medio_pago_id: string;
          nombre: string;
          orden: number;
          tipo: string;
        }[];
      };
      caja_medios_a_contar: {
        Args: { p_caja_id: string };
        Returns: {
          medio_pago_id: string;
          nombre: string;
          tipo: string;
        }[];
      };
      caja_validar_acceso: {
        Args: {
          p_caja: Database["public"]["Tables"]["cajas"]["Row"];
          p_uid: string;
        };
        Returns: undefined;
      };
      cerrar_caja: {
        Args: { p_caja_id: string; p_conteos: Json; p_nota?: string };
        Returns: Json;
      };
      corte_dia_comercial: { Args: never; Returns: string };
      crear_combo: {
        Args: {
          p_desde: string;
          p_dias: number[];
          p_hasta: string;
          p_items: Json;
          p_nombre: string;
          p_precio: number;
        };
        Returns: string;
      };
      current_comercio_id: { Args: never; Returns: string };
      current_rol: {
        Args: never;
        Returns: Database["public"]["Enums"]["rol_usuario"];
      };
      descuento_promocion: {
        Args: {
          p_cantidad: number;
          p_precio: number;
          p_promo: Database["public"]["Tables"]["promociones"]["Row"];
        };
        Returns: number;
      };
      gasto_validar_rol: { Args: never; Returns: undefined };
      guardar_producto: {
        Args: {
          p_categoria_id: string;
          p_codigo_barras: string;
          p_controla_stock?: boolean;
          p_costo: number;
          p_costo_anterior?: number;
          p_id: string;
          p_nombre: string;
          p_precio: number;
          p_precio_anterior?: number;
          p_precio_libre?: boolean;
          p_proveedor_id?: string;
          p_stock_minimo: number;
          p_unidad_venta: string;
        };
        Returns: string;
      };
      importar_productos: { Args: { p_productos: Json }; Returns: Json };
      inicio_resumen: { Args: never; Returns: Json };
      listar_usuarios: {
        Args: never;
        Returns: {
          activo: boolean;
          administrable: boolean;
          contrasena_temporal: boolean;
          email: string;
          id: string;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
        }[];
      };
      marcar_venta_revisada: { Args: { p_venta_id: string }; Returns: Json };
      pagar_gasto: {
        Args: { p_caja_id?: string; p_gasto_id: string };
        Returns: undefined;
      };
      puede_administrar_usuario: {
        Args: { p_usuario_id: string };
        Returns: boolean;
      };
      registrar_compra: {
        Args: {
          p_caja_id?: string;
          p_comprobante: string;
          p_items: Json;
          p_pago: string;
          p_proveedor_id: string;
          p_vencimiento?: string;
        };
        Returns: Json;
      };
      registrar_gasto: {
        Args: {
          p_caja_id?: string;
          p_descripcion: string;
          p_monto: number;
          p_pagado: boolean;
          p_tipo: string;
          p_vencimiento: string;
        };
        Returns: string;
      };
      registrar_movimiento_caja: {
        Args: {
          p_caja_id: string;
          p_monto: number;
          p_motivo: string;
          p_tipo: string;
        };
        Returns: string;
      };
      registrar_venta: {
        Args: {
          p_caja_id: string;
          p_descuento_pct?: number;
          p_items: Json;
          p_pagos: Json;
          p_venta_id?: string;
        };
        Returns: Json;
      };
      registrar_venta_sin_conexion: {
        Args: {
          p_caja_id: string;
          p_descuento?: number;
          p_fecha: string;
          p_items: Json;
          p_pagos: Json;
          p_venta_id: string;
        };
        Returns: Json;
      };
      reporte_ventas: {
        Args: {
          p_agrupar?: string;
          p_desde: string;
          p_hasta: string;
          p_usuario_id?: string;
        };
        Returns: Json;
      };
      siguiente_codigo_interno: { Args: never; Returns: string };
      vencimientos_proximos: { Args: never; Returns: Json };
    };
    Enums: {
      rol_usuario: "dueno" | "encargado" | "cajero";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      rol_usuario: ["dueno", "encargado", "cajero"],
    },
  },
} as const;
