"use client";

import type { CajaParaPagar } from "../queries";

export const POR_FUERA = "por-fuera";

// De dónde sale la plata de un gasto. Sin valor por defecto: elegir mal descuadra el arqueo.
export function FormaDePago({
  id,
  cajas,
  value,
  onChange,
}: {
  id: string;
  cajas: CajaParaPagar[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        ¿De dónde salió la plata?
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <option value="" disabled>
          Elegí una opción
        </option>
        {cajas.map((caja) => (
          <option key={caja.id} value={caja.id}>
            {caja.nombre}
          </option>
        ))}
        <option value={POR_FUERA}>Por fuera de la caja</option>
      </select>
      <p className="text-xs text-muted-foreground">
        Si sale de una caja, se registra como retiro y entra en su arqueo.
      </p>
    </div>
  );
}
