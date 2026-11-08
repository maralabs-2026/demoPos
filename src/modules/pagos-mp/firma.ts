import { createHmac, timingSafeEqual } from "node:crypto";

type DatosFirma = {
  header: string | null;
  requestId: string | null;
  dataId: string | null;
  secreto: string;
};

function leerFirma(header: string) {
  const partes = new Map(
    header.split(",").map((parte) => {
      const [clave, ...valor] = parte.split("=");
      return [clave.trim(), valor.join("=").trim()] as const;
    }),
  );
  return { ts: partes.get("ts"), v1: partes.get("v1") };
}

// Plantilla de Mercado Pago: id:[data.id];request-id:[x-request-id];ts:[ts]; sin los segmentos que
// falten y con el id en minúsculas. No se limita la antigüedad de ts para no rechazar reintentos:
// la firma solo filtra ruido, porque el resultado siempre sale de consultar la orden.
export function firmaValida({
  header,
  requestId,
  dataId,
  secreto,
}: DatosFirma) {
  if (!header || !secreto) return false;
  const { ts, v1 } = leerFirma(header);
  if (!ts || !v1) return false;

  const manifiesto =
    (dataId ? `id:${dataId.toLowerCase()};` : "") +
    (requestId ? `request-id:${requestId};` : "") +
    `ts:${ts};`;
  const esperada = createHmac("sha256", secreto)
    .update(manifiesto)
    .digest("hex");

  const a = Buffer.from(esperada);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
