import { describe, expect, it } from "vitest";
import { tipoDeLogo } from "./logo";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);

describe("tipoDeLogo", () => {
  it("reconoce PNG, JPEG y WebP por sus primeros bytes", () => {
    expect(
      tipoDeLogo(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("png");
    expect(tipoDeLogo(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(
      tipoDeLogo(
        bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toBe("webp");
  });

  it("rechaza otros formatos aunque se llamen .png", () => {
    // GIF, SVG (texto) y un RIFF que no es WebP.
    expect(tipoDeLogo(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull();
    expect(tipoDeLogo(new TextEncoder().encode("<svg></svg>"))).toBeNull();
    expect(
      tipoDeLogo(
        bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20),
      ),
    ).toBeNull();
    expect(tipoDeLogo(new Uint8Array())).toBeNull();
  });
});
