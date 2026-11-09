import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Producto } from "../queries";
import { ProductosTable } from "./productos-table";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ eliminarProducto: vi.fn() }));
vi.mock("./producto-form", () => ({ ProductoForm: () => null }));
vi.mock("./etiquetas-dialog", () => ({ EtiquetasDialog: () => null }));

const producto: Producto = {
  id: "1",
  nombre: "Coca-Cola 500ml",
  categoriaId: null,
  categoriaNombre: "Bebidas",
  codigoBarras: "7790000000001",
  costo: 1234,
  precio: 2500,
  stockActual: 10,
  stockMinimo: 2,
  controlaStock: true,
  precioLibre: false,
  proveedorId: null,
  unidadVenta: "unidad",
  fotoUrl: null,
};

function render(puedeGestionar: boolean) {
  return renderToStaticMarkup(
    createElement(ProductosTable, {
      productos: [producto],
      categorias: [],
      puedeGestionar,
      puedeCrearCategoria: false,
      proveedores: [],
    }),
  );
}

describe("ProductosTable", () => {
  it("al cajero le muestra precio y stock, sin costo, margen ni acciones", () => {
    const html = render(false);

    expect(html).toContain("2.500,00");
    expect(html).toContain("10 unidad");
    expect(html).not.toContain("1.234,00");
    expect(html).not.toMatch(/Costo|Margen|Acciones/);
    expect(html).not.toMatch(/Editar|Etiquetas|Eliminar/);
  });

  it("a quien gestiona le muestra costo, margen y acciones", () => {
    const html = render(true);

    expect(html).toContain("1.234,00");
    expect(html).toMatch(/Margen/);
    expect(html).toMatch(/Editar/);
    expect(html).toMatch(/Etiquetas/);
    expect(html).toMatch(/Eliminar/);
  });
});
