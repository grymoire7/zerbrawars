import { describe, expect, it } from "vitest";
import { PALETTE, hex, type PaletteName } from "./palette";

function luminance(color: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

function contrast(a: PaletteName, b: PaletteName): number {
  const [hi, lo] = [luminance(PALETTE[a]), luminance(PALETTE[b])].sort(
    (x, y) => y - x,
  );
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("palette", () => {
  it("has only valid 6-digit hex values", () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      expect(value, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("hex() returns the numeric value", () => {
    expect(hex("bg")).toBe(0x15171c);
    expect(hex("white")).toBe(0xffffff);
  });

  const surfaces: PaletteName[] = ["bg", "surface", "raised"];
  const textTokens: PaletteName[] = [
    "text",
    "text-muted",
    "warn",
    "goal",
    "med",
    "energy",
    "tissue",
    "heat",
    "strep-ink",
    "staph-ink",
    "aspergillus-ink",
    "incoming",
  ];
  for (const t of textTokens) {
    for (const s of surfaces) {
      it(`${t} on ${s} meets 4.5:1`, () => {
        expect(contrast(t, s)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("incoming ring meets 3:1 on bg and on the dark halo", () => {
    expect(contrast("incoming", "bg")).toBeGreaterThanOrEqual(3);
    expect(contrast("incoming", "mark-halo")).toBeGreaterThanOrEqual(3);
  });

  it("order on bg and text on control meet 4.5:1", () => {
    expect(contrast("order", "bg")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("text", "control")).toBeGreaterThanOrEqual(4.5);
  });
});
