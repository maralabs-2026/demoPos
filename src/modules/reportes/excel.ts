import { formatDateTime } from "@/lib/date";
import type { VentaExportada } from "./queries";

const MONEDA = "#,##0.00";

type Columna = {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
};

async function libroConHoja(nombre: string, columnas: Columna[]) {
  // Se carga recién al exportar: es pesada y el resto de las pantallas no la usa.
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(nombre, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  hoja.columns = columnas.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
    style: c.numFmt ? { numFmt: c.numFmt } : {},
  }));
  hoja.getRow(1).font = { bold: true };
  return { libro, hoja };
}

export async function excelDeVentas(
  filas: VentaExportada[],
  truncado: boolean,
): Promise<ArrayBuffer> {
  const { libro, hoja } = await libroConHoja("Ventas", [
    { header: "Fecha", key: "fecha", width: 18 },
    { header: "Venta", key: "numero", width: 11 },
    { header: "Cajero", key: "cajero", width: 20 },
    { header: "Estado", key: "estado", width: 12 },
    { header: "Producto", key: "producto", width: 36 },
    { header: "Cantidad", key: "cantidad", width: 10 },
    {
      header: "Precio unitario",
      key: "precioUnitario",
      width: 15,
      numFmt: MONEDA,
    },
    { header: "Descuento", key: "descuento", width: 12, numFmt: MONEDA },
    { header: "Promoción", key: "promocion", width: 20 },
    { header: "Subtotal", key: "subtotal", width: 13, numFmt: MONEDA },
    {
      header: "Costo unitario",
      key: "costoUnitario",
      width: 14,
      numFmt: MONEDA,
    },
  ]);
  for (const fila of filas) {
    hoja.addRow({ ...fila, fecha: formatDateTime(fila.fecha) });
  }
  if (truncado) {
    hoja.addRow({
      fecha: "Faltan filas: el período es muy largo. Exportá uno más corto.",
    });
  }
  return (await libro.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}

export type ProductoExportado = {
  nombre: string;
  categoriaNombre: string | null;
  codigoBarras: string;
  stockActual: number;
  stockMinimo: number;
  precio: number;
  costo: number | null;
};

export async function excelDeStock(
  productos: ProductoExportado[],
): Promise<ArrayBuffer> {
  const { libro, hoja } = await libroConHoja("Stock", [
    { header: "Producto", key: "nombre", width: 36 },
    { header: "Categoría", key: "categoriaNombre", width: 22 },
    { header: "Código de barras", key: "codigoBarras", width: 18 },
    { header: "Stock", key: "stockActual", width: 9 },
    { header: "Stock mínimo", key: "stockMinimo", width: 13 },
    { header: "Precio", key: "precio", width: 13, numFmt: MONEDA },
    { header: "Costo", key: "costo", width: 13, numFmt: MONEDA },
  ]);
  for (const producto of productos) hoja.addRow(producto);
  return (await libro.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
