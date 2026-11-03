import { describe, expect, it } from "vitest";
import { CARD_IDS } from "../sim/life/cards";
import { PALETTE, type PaletteName } from "../theme/palette";
import { CARD_FAMILY, CARD_ICON, cardAccent, cardTint } from "./cardStyle";

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

const ids = [...CARD_IDS, "rest"];

describe("card styles", () => {
  for (const id of ids) {
    it(`${id} has a family, an icon and palette tokens`, () => {
      expect(CARD_FAMILY[id], "family").toBeDefined();
      expect(CARD_ICON[id], "icon").toBeTruthy();
      expect(PALETTE[cardAccent(id)], "accent").toBeDefined();
      expect(PALETTE[cardTint(id)], "tint").toBeDefined();
    });
    it(`${id} icon ink, text and accent meet contrast`, () => {
      expect(contrast("bg", cardAccent(id))).toBeGreaterThanOrEqual(4.5);
      expect(contrast("text", cardTint(id))).toBeGreaterThanOrEqual(4.5);
      expect(contrast("text-muted", cardTint(id))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(cardAccent(id), cardTint(id))).toBeGreaterThanOrEqual(3);
    });
  }

  it("each card has its own icon", () => {
    const paths = ids.map((id) => CARD_ICON[id]);
    expect(new Set(paths).size).toBe(ids.length);
  });

  it("families have distinct accents", () => {
    const fams = [...new Set(Object.values(CARD_FAMILY))];
    const colors = fams.map((f) => PALETTE[`card-${f}` as PaletteName]);
    expect(new Set(colors).size).toBe(fams.length);
  });
});
