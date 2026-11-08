import { describe, expect, it } from "vitest";
import { auditoriaSchema } from "./schemas";
import {
  agruparPorProveedor,
  reposicionComoTexto,
  sugerirReposicion,
} from "./reposicion";

const producto = (
  nombre: string,
  stockActual: number,
  stockMinimo: number,
) => ({
  id: nombre,
  nombre,
  stockActual,
  stockMinimo,
});

describe("sugerirReposicion", () => {
  it("sugiere lo que falta para llegar al doble del mínimo", () => {
    expect(sugerirReposicion([producto("Coca", 3, 10)])[0].cantidad).toBe(17);
    expect(sugerirReposicion([producto("Agua", 0, 5)])[0].cantidad).toBe(10);
  });

  it("deja afuera lo que está en el mínimo o sin mínimo", () => {
    expect(
      sugerirReposicion([
        producto("Justo", 5, 5),
        producto("Sin mínimo", 0, 0),
      ]),
    ).toEqual([]);
  });
});

describe("reposicionComoTexto", () => {
  it("lista cantidad y producto", () => {
    expect(
      reposicionComoTexto(
        sugerirReposicion([producto("Coca", 3, 10)]),
        "Kiosko",
      ),
    ).toBe("Reposición - Kiosko\n\n17 × Coca");
  });
});

describe("auditoriaSchema", () => {
  const id = "7d3f9a52-1c64-4b8e-9f21-3a5c7e9d1b20";

  it("acepta contar cero y productos sin categoría", () => {
    expect(
      auditoriaSchema.safeParse({
        categoriaId: null,
        conteos: [{ productoId: id, contado: 0 }],
      }).success,
    ).toBe(true);
  });

  it.each([
    ["negativo", -1],
    ["con decimales", 1.5],
  ])("rechaza un conteo %s", (_, contado) => {
    expect(
      auditoriaSchema.safeParse({
        categoriaId: id,
        conteos: [{ productoId: id, contado }],
      }).success,
    ).toBe(false);
  });

  it("rechaza una auditoría sin conteos", () => {
    expect(
      auditoriaSchema.safeParse({ categoriaId: id, conteos: [] }).success,
    ).toBe(false);
  });
});

describe("agruparPorProveedor", () => {
  const linea = (nombre: string, proveedorId: string | null) => ({
    id: nombre,
    nombre,
    stockActual: 0,
    stockMinimo: 1,
    cantidad: 2,
    proveedorId,
  });
  const proveedores = [
    { id: "b", nombre: "Zeta", telefono: null },
    { id: "a", nombre: "Alfa", telefono: "5493511234567" },
  ];

  it("arma un pedido por proveedor, por nombre, y al final lo que no tiene", () => {
    const pedidos = agruparPorProveedor(
      [linea("1", "b"), linea("2", null), linea("3", "a"), linea("4", "a")],
      proveedores,
    );
    expect(pedidos.map((p) => p.nombre)).toEqual([
      "Alfa",
      "Zeta",
      "Sin proveedor",
    ]);
    expect(pedidos[0].lineas.map((l) => l.nombre)).toEqual(["3", "4"]);
    expect(pedidos[0].telefono).toBe("5493511234567");
  });

  it("sin lista de proveedores, todo queda sin proveedor", () => {
    const pedidos = agruparPorProveedor([linea("1", "b")], []);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].proveedorId).toBeNull();
  });
});
