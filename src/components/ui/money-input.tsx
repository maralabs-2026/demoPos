"use client";

import * as React from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { formatAmount, parseCurrency } from "@/lib/currency";

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

  const formatted = value === null ? "" : formatAmount(value);
  const shown = focused ? text : formatted;
  const invalid = focused && text.trim() !== "" && parseCurrency(text) === null;

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
        value={shown}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        onFocus={(e) => {
          setText(formatted);
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        onChange={(e) => {
          setText(e.target.value);
          onValueChange(parseCurrency(e.target.value));
        }}
        className={cn("pl-8 text-right font-semibold tabular-nums", className)}
        {...props}
      />
    </div>
  );
}

export { MoneyInput };
