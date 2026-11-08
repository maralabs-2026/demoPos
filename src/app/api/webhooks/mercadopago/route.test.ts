import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sincronizarOrden } from "@/modules/pagos-mp";
import { POST } from "./route";

vi.mock("@/modules/pagos-mp", async () => ({
  firmaValida: (await import("@/modules/pagos-mp/firma")).firmaValida,
  sincronizarOrden: vi.fn(),
}));

const secreto = "secreto-de-prueba";
const sincronizar = vi.mocked(sincronizarOrden);

function aviso(opciones: { firma?: string; type?: string } = {}) {
  const manifiesto = "id:ord1;request-id:req-1;ts:5;";
  const v1 = createHmac("sha256", secreto).update(manifiesto).digest("hex");
  return new NextRequest(
    "https://pos.test/api/webhooks/mercadopago?data.id=ORD1",
    {
      method: "POST",
      headers: {
        "x-signature": opciones.firma ?? `ts=5,v1=${v1}`,
        "x-request-id": "req-1",
      },
      body: JSON.stringify({
        type: opciones.type ?? "order",
        data: { id: "ORD1" },
      }),
    },
  );
}

beforeEach(() => {
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", secreto);
  sincronizar.mockReset();
  sincronizar.mockResolvedValue({ ok: true, data: "aprobado" });
});

afterEach(() => vi.unstubAllEnvs());

describe("webhook de Mercado Pago", () => {
  it("consulta la orden cuando la firma es válida", async () => {
    expect((await POST(aviso())).status).toBe(200);
    expect(sincronizar).toHaveBeenCalledWith("ORD1");
  });

  it("rechaza una firma inválida sin consultar", async () => {
    expect((await POST(aviso({ firma: "ts=5,v1=mala" }))).status).toBe(401);
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it("ignora otros tipos de aviso", async () => {
    expect((await POST(aviso({ type: "payment" }))).status).toBe(200);
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it("pide reintento si falla la consulta", async () => {
    sincronizar.mockResolvedValue({ ok: false, error: "x" });
    expect((await POST(aviso())).status).toBe(500);
  });

  it("no acepta avisos sin el secreto configurado", async () => {
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "");
    expect((await POST(aviso())).status).toBe(503);
  });
});
