import { NextResponse, type NextRequest } from "next/server";
import { todayISO } from "@/lib/date";
import { requireRol } from "@/modules/auth";
import { getProductos } from "@/modules/productos";
import {
  excelDeStock,
  excelDeVentas,
  filtrosDesdeParams,
  getVentasParaExportar,
} from "@/modules/reportes";

export const dynamic = "force-dynamic";

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function archivo(contenido: ArrayBuffer, nombre: string) {
  return new NextResponse(contenido, {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

function error(mensaje: string, status: number) {
  return new NextResponse(mensaje, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  await requireRol("/reportes");

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const hoy = todayISO();

  if (params.tipo === "stock") {
    const productos = await getProductos(undefined, true);
    if (!productos.ok) return error("No se pudo leer el stock.", 500);
    return archivo(await excelDeStock(productos.data), `stock-${hoy}`);
  }

  if (params.tipo === "ventas") {
    const filtros = filtrosDesdeParams(params, hoy);
    const ventas = await getVentasParaExportar(filtros);
    if (!ventas.ok) return error("No se pudieron leer las ventas.", 500);
    return archivo(
      await excelDeVentas(ventas.data.filas, ventas.data.truncado),
      `ventas-${filtros.desde}-a-${filtros.hasta}`,
    );
  }

  return error("Exportación desconocida.", 400);
}
