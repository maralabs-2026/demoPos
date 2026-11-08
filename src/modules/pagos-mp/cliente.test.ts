import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarOrden, crearOrden } from "./cliente";

const orden = { id: "ORD1", status: "created" };
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "token-de-prueba");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cliente de Mercado Pago", () => {
  it("crea la orden estática con dos decimales e idempotencia", async () => {
    fetchMock.mockResolvedValue(Response.json(orden, { status: 201 }));
    const r = await crearOrden({
      cobroId: "cobro-1",
      monto: 1500.5,
      externalPosId: "CAJA1",
    });
    expect(r).toEqual({ ok: true, data: orden });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/v1/orders");
    expect(init.headers["X-Idempotency-Key"]).toBe("cobro-1");
    expect(init.headers.Authorization).toBe("Bearer token-de-prueba");
    const body = JSON.parse(init.body);
    expect(body.total_amount).toBe("1500.50");
    expect(body.external_reference).toBe("cobro-1");
    expect(body.config.qr).toEqual({
      external_pos_id: "CAJA1",
      mode: "static",
    });
  });

  it("no llama sin token", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    const r = await consultarOrden("ORD1");
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve error ante rechazo, corte o respuesta rara", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect((await consultarOrden("ORD1")).ok).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("corte"));
    expect((await consultarOrden("ORD1")).ok).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json({ nada: true }));
    expect((await consultarOrden("ORD1")).ok).toBe(false);
  });

  it("escapa el id en la ruta", async () => {
    fetchMock.mockResolvedValue(Response.json(orden));
    await consultarOrden("a/b");
    expect(fetchMock.mock.calls[0][0]).toMatch(/orders\/a%2Fb$/);
  });
});
