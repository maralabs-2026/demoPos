import { describe, expect, it, vi } from "vitest";
import { estadoDeOrden } from "./sincronizar";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const cobroId = "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b";

describe("estado de la orden", () => {
  it("traduce una orden pagada con su monto", () => {
    expect(
      estadoDeOrden({
        id: "ORD1",
        status: "processed",
        external_reference: cobroId,
        total_paid_amount: "1500.50",
      }),
    ).toEqual({ cobroId, estado: "aprobado", montoPagado: 1500.5 });
  });

  it("deja sin monto a la orden sin pago informado", () => {
    expect(
      estadoDeOrden({
        id: "O",
        status: "expired",
        external_reference: cobroId,
      }),
    ).toEqual({ cobroId, estado: "expirado", montoPagado: null });
  });

  it("ignora órdenes en curso o ajenas", () => {
    expect(
      estadoDeOrden({
        id: "O",
        status: "created",
        external_reference: cobroId,
      }),
    ).toBeNull();
    expect(
      estadoDeOrden({ id: "O", status: "processed", external_reference: "x" }),
    ).toBeNull();
    expect(estadoDeOrden({ id: "O", status: "processed" })).toBeNull();
  });
});
