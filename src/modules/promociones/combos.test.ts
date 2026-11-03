import { describe, expect, it } from "vitest";
import { aplicarCombos, type Combo } from "./logica";

const ahora = { dia: 1, hora: "12:00:00" };
const COCA = "aaaa-coca";
const OTRO = "bbbb-otro";

const comboBase: Combo = {
  id: "c1",
  nombre: "Combo test",
  precio: 5333.33, // 2500 + 3333.33 - 500
  dias: [0, 1, 2, 3, 4, 5, 6],
  desde: "00:00:00",
  hasta: "23:59:59",
  activa: true,
  items: [
    { productoId: COCA, cantidad: 1 },
    { productoId: OTRO, cantidad: 1 },
  ],
};

describe("aplicarCombos", () => {
  it("aplica el combo una vez y reparte el descuento al centavo", () => {
    const r = aplicarCombos(
      [
        { productoId: COCA, categoriaId: null, precio: 2500, cantidad: 1 },
        { productoId: OTRO, categoriaId: null, precio: 3333.33, cantidad: 1 },
      ],
      [comboBase],
      ahora,
    );
    // 500 se reparte por precio: 3333.33 / 5833.33 de 500 = 285.71; el resto (214.29) va a la Coca,
    // menor producto_id.
    expect(r.get(COCA)?.descuento).toBe(214.29);
    expect(r.get(OTRO)?.descuento).toBe(285.71);
    expect((r.get(COCA)?.descuento ?? 0) + (r.get(OTRO)?.descuento ?? 0)).toBe(500);
    expect(r.get(COCA)?.nombres).toEqual(["Combo test"]);
  });

  it("aplica tantos combos completos como entren", () => {
    const r = aplicarCombos(
      [
        { productoId: COCA, categoriaId: null, precio: 2500, cantidad: 2 },
        { productoId: OTRO, categoriaId: null, precio: 3333.33, cantidad: 2 },
      ],
      [comboBase],
      ahora,
    );
    expect((r.get(COCA)?.descuento ?? 0) + (r.get(OTRO)?.descuento ?? 0)).toBe(1000);
    expect(r.get(COCA)?.consumido).toBe(2);
    expect(r.get(OTRO)?.consumido).toBe(2);
  });

  it("con dos Coca y un otro, el combo se aplica una sola vez", () => {
    const r = aplicarCombos(
      [
        { productoId: COCA, categoriaId: null, precio: 2500, cantidad: 2 },
        { productoId: OTRO, categoriaId: null, precio: 3333.33, cantidad: 1 },
      ],
      [comboBase],
      ahora,
    );
    expect(r.get(COCA)?.consumido).toBe(1);
    expect(r.get(OTRO)?.consumido).toBe(1);
  });

  it("no aplica si falta un producto del combo", () => {
    const r = aplicarCombos(
      [{ productoId: COCA, categoriaId: null, precio: 2500, cantidad: 3 }],
      [comboBase],
      ahora,
    );
    expect(r.size).toBe(1);
    expect(r.get(COCA)?.descuento).toBe(0);
    expect(r.get(COCA)?.consumido).toBe(0);
  });

  it("no aplica fuera de su día de vigencia", () => {
    const r = aplicarCombos(
      [
        { productoId: COCA, categoriaId: null, precio: 2500, cantidad: 1 },
        { productoId: OTRO, categoriaId: null, precio: 3333.33, cantidad: 1 },
      ],
      [{ ...comboBase, dias: [6] }],
      ahora,
    );
    expect(r.get(COCA)?.descuento).toBe(0);
  });

  it("no aplica si el precio del combo no es menor que la suma", () => {
    const r = aplicarCombos(
      [
        { productoId: COCA, categoriaId: null, precio: 2500, cantidad: 1 },
        { productoId: OTRO, categoriaId: null, precio: 3333.33, cantidad: 1 },
      ],
      [{ ...comboBase, precio: 6000 }],
      ahora,
    );
    expect(r.get(COCA)?.descuento).toBe(0);
    expect(r.get(OTRO)?.descuento).toBe(0);
  });

  // Mismos números que el caso (i) de supabase/tests/fase4d2_combos_validation.sql: la pantalla y la
  // base tienen que repartir igual, también con un producto de regalo y un medio centavo.
  it("reparte al centavo sin negativos, con un producto a $ 0", () => {
    const lineas = ["id0-regalo", "id1-a", "id2-b", "id3-c"].map((productoId, i) => ({
      productoId,
      categoriaId: null,
      precio: i === 0 ? 0 : 10.01,
      cantidad: 1,
    }));
    const r = aplicarCombos(
      lineas,
      [
        {
          ...comboBase,
          precio: 20,
          items: lineas.map((l) => ({ productoId: l.productoId, cantidad: 1 })),
        },
      ],
      ahora,
    );
    expect(lineas.map((l) => r.get(l.productoId)?.descuento)).toEqual([
      0, 3.34, 3.35, 3.34,
    ]);
  });

  it("un combo no reusa unidades que ya usó otro combo", () => {
    const otro: Combo = { ...comboBase, id: "c2", nombre: "Combo 2", precio: 5000 };
    const r = aplicarCombos(
      [
        { productoId: COCA, categoriaId: null, precio: 2500, cantidad: 1 },
        { productoId: OTRO, categoriaId: null, precio: 3333.33, cantidad: 1 },
      ],
      [comboBase, otro],
      ahora,
    );
    expect(r.get(COCA)?.nombres).toEqual(["Combo test"]);
  });
});
