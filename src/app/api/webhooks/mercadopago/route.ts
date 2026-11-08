import { NextResponse, type NextRequest } from "next/server";
import { firmaValida, sincronizarOrden } from "@/modules/pagos-mp";

type Aviso = { type?: unknown; data?: { id?: unknown } } | null;

// Un error devuelve 500 para que Mercado Pago reintente. El contenido del aviso no se usa: solo el
// id de la orden, que después se consulta a Mercado Pago.
export async function POST(request: NextRequest) {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto) return new NextResponse(null, { status: 503 });

  const idEnUrl = request.nextUrl.searchParams.get("data.id");
  const valida = firmaValida({
    header: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: idEnUrl,
    secreto,
  });
  if (!valida) return new NextResponse(null, { status: 401 });

  const aviso = (await request.json().catch(() => null)) as Aviso;
  const orderId = idEnUrl ?? aviso?.data?.id;
  if (aviso?.type !== "order" || typeof orderId !== "string" || !orderId) {
    return new NextResponse(null, { status: 200 });
  }

  const resultado = await sincronizarOrden(orderId);
  return new NextResponse(null, { status: resultado.ok ? 200 : 500 });
}
