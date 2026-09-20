import { describe, expect, it } from "vitest";
import { fail, ok } from "./result";

describe("ActionResult helpers", () => {
  it("wraps data in an ok result", () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
  });

  it("wraps a message in a failed result", () => {
    expect(fail("sin stock")).toEqual({ ok: false, error: "sin stock" });
  });
});
