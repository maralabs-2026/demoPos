import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Producto } from "../queries";
import { ProductosTable } from "./productos-table";

const url = vi.hoisted(() => ({ query: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(url.query),
}));
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

function render(puedeGestionar: boolean, productos = [producto]) {
  return renderToStaticMarkup(
    createElement(ProductosTable, {
      productos,
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

  describe("con el filtro de faltantes", () => {
    const faltante = { ...producto, stockActual: 1 };

    beforeEach(() => {
      url.query = "stock=faltantes";
    });
    afterEach(() => {
      url.query = "";
    });

    it("quien gestiona puede sumar stock", () => {
      expect(render(true, [faltante])).toContain("Sumar stock");
    });

    it("el cajero ve el filtro pero no puede sumar stock", () => {
      const html = render(false, [faltante]);

      expect(html).toContain("Faltantes (1)");
      expect(html).not.toContain("Sumar stock");
    });

    it("oculta lo que tiene stock suficiente", () => {
      expect(render(true, [producto])).not.toContain("Coca-Cola");
    });
  });
});
