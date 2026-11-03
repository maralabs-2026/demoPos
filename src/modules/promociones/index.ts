// Public API of the promociones module. Other modules import only from here.
// Solo lo que se puede usar en el navegador: las consultas y acciones del servidor se importan
// desde "./queries" y "./actions" (usan next/headers y no pueden entrar al bundle del cliente).
export {
  ahoraEnCordoba,
  aplicarCombos,
  descuentoPromocion,
  mejorPromo,
  promoVigente,
} from "./logica";
export type {
  Ahora,
  Combo,
  ComboItem,
  DescuentoCombo,
  LineaPromo,
  Promo,
  TipoPromo,
} from "./logica";
export { comboSchema, promocionSchema } from "./schemas";
export type { ComboInput, PromocionInput } from "./schemas";
