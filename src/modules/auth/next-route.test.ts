import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, getNextRoute } from "./next-route";

describe("getNextRoute", () => {
  it("defaults to /vender when next is missing", () => {
    expect(getNextRoute(undefined)).toBe(DEFAULT_NEXT);
  });

  it("defaults to /vender when next is empty", () => {
    expect(getNextRoute("")).toBe(DEFAULT_NEXT);
  });

  it("accepts valid internal routes", () => {
    expect(getNextRoute("/productos")).toBe("/productos");
    expect(getNextRoute("/")).toBe("/");
  });

  it("rejects external URLs", () => {
    expect(getNextRoute("https://sitio-externo.com")).toBe(DEFAULT_NEXT);
  });

  it("rejects protocol-relative URLs", () => {
    expect(getNextRoute("//sitio-externo.com")).toBe(DEFAULT_NEXT);
  });

  it("rejects non-string values", () => {
    expect(getNextRoute(["/productos"])).toBe(DEFAULT_NEXT);
    expect(getNextRoute(null)).toBe(DEFAULT_NEXT);
  });
});
