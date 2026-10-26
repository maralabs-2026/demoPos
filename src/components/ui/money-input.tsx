"use client";

import * as React from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { formatAmount, parseMonto } from "@/lib/currency";

type MoneyInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
};

/**
 * Input de montos en formato argentino. Mientras se escribe acepta
 * "1234,5" o "1.234,50"; al salir del campo muestra el monto formateado.
 * Siempre entrega un `number` (o `null` si está vacío o es inválido).
 * Un texto inválido no se borra al salir: queda a la vista, marcado en rojo.
 */
function MoneyInput({
  value,
  onValueChange,
  className,
  onFocus,
  onBlur,
  "aria-invalid": ariaInvalid,
  ...props
}: MoneyInputProps) {
  const [focused, setFocused] = React.useState(false);
  const [text, setText] = React.useState("");
  // Valor que produjo `text`: si después cambia desde afuera (por ejemplo
  // "Exacto"), el texto inválido ya no aplica y se muestra el monto nuevo.
  const [textValue, setTextValue] = React.useState<number | null>(null);

  const formatted = value === null ? "" : formatAmount(value);
  const parsed = parseMonto(text);
  const invalid =
    text.trim() !== "" && Number.isNaN(parsed) && textValue === value;
  // Mientras se escribe, o si quedó inválido, se muestra lo escrito tal cual.
  const shownText = focused || invalid;

  return (
    <div data-slot="money-input" className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-semibold text-muted-foreground"
      >
        $
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shownText ? text : formatted}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        onFocus={(e) => {
          if (!invalid) setText(formatted);
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        onChange={(e) => {
          const v = parseMonto(e.target.value);
          const next = v === null || Number.isNaN(v) ? null : v;
          setText(e.target.value);
          setTextValue(next);
          onValueChange(next);
        }}
        className={cn("pl-8 text-right font-semibold tabular-nums", className)}
        {...props}
      />
    </div>
  );
}

export { MoneyInput };
