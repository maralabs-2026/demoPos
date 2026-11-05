import { describe, expect, it } from "vitest";
import {
  comboSchema,
  DIAS_MAX,
  ITEMS_COMBO_MAX,
  promocionSchema,
} from "./schemas";

const PRODUCTO = "6d1c4f5b-8e0a-4b2c-9d9e-4f5a6b7c8d9e";

const promo = {
  nombre: "Finde",
  tipo: "porcentaje",
  alcance: "producto",
  productoId: PRODUCTO,
  categoriaId: null,
  lleva: null,
  paga: null,
  cantidad: null,
  precio: null,
  porcentaje: 10,
  dias: [0, 6],
  desde: "00:00",
  hasta: "23:59",
};

// Productos distintos, porque el combo no acepta repetidos.
const itemsCombo = (largo: number) =>
  Array.from({ length: largo }, (_, i) => ({
    productoId: `producto-${i}`,
    cantidad: 1,
  }));

const combo = {
  nombre: "Desayuno",
  precio: 2500,
  dias: [0, 6],
  desde: "00:00",
  hasta: "23:59",
  items: itemsCombo(2),
};

const semana = [0, 1, 2, 3, 4, 5, 6];

describe("promocionSchema", () => {
  it("acepta los 7 días y rechaza uno más", () => {
    expect(promocionSchema.safeParse({ ...promo, dias: semana }).success).toBe(
      true,
    );
    expect(semana).toHaveLength(DIAS_MAX);
    expect(
      promocionSchema.safeParse({ ...promo, dias: [...semana, 0] }).error
        ?.issues[0]?.message,
    ).toBe("Elegí hasta 7 días");
  });
});

describe("comboSchema", () => {
  it("acepta los 7 días y rechaza uno más", () => {
    expect(comboSchema.safeParse({ ...combo, dias: semana }).success).toBe(
      true,
    );
    expect(
      comboSchema.safeParse({ ...combo, dias: [...semana, 0] }).error?.issues[0]
        ?.message,
    ).toBe("Elegí hasta 7 días");
  });

  it("acepta hasta el tope de productos y rechaza uno más", () => {
    expect(
      comboSchema.safeParse({ ...combo, items: itemsCombo(ITEMS_COMBO_MAX) })
        .success,
    ).toBe(true);
    expect(
      comboSchema.safeParse({
        ...combo,
        items: itemsCombo(ITEMS_COMBO_MAX + 1),
      }).error?.issues[0]?.message,
    ).toBe("Un combo puede tener hasta 20 productos");
  });
});
