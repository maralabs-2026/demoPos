"use client";

import { useState } from "react";
import { ProductoForm } from "@/modules/productos/components/producto-form";
import type { Categoria } from "@/modules/productos";
import type { ProductoFormInput } from "@/modules/productos/schemas";

// TODO(fase-3): reemplaza este preview por la llamada real a createProducto (server action)
// en la semana 2, cuando el login permita ejecutar la escritura con el rol correcto.
export function NuevoProductoForm({ categorias }: { categorias: Categoria[] }) {
  const [ultimoValido, setUltimoValido] = useState<ProductoFormInput | null>(
    null,
  );

  return (
    <div className="space-y-3">
      <ProductoForm
        categorias={categorias}
        onSubmit={(data) => setUltimoValido(data)}
      />
      {ultimoValido && (
        <div className="rounded-md border border-green-600/30 bg-green-50 p-3 text-sm dark:bg-green-950/40">
          Datos válidos, listos para guardar. Todavía no se escriben en la base
          (falta el login de la Fase 2).
          <pre className="text-muted-foreground mt-2 overflow-x-auto text-xs">
            {JSON.stringify(ultimoValido, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
