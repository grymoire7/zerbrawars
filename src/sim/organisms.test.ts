import { describe, expect, it } from "vitest";
import {
  chargeTargets,
  formNoun,
  organismAria,
  organismCount,
  organismCountShort,
  organismDescription,
  organismKeyText,
  organismList,
  organismName,
  organismScientific,
  organismShort,
  organismSub,
} from "./organisms";
import { PATHOGEN_KINDS, type PathogenKindId } from "./pathogens";

const KINDS = Object.keys(PATHOGEN_KINDS) as PathogenKindId[];

describe("organisms", () => {
  it("names every kind", () => {
    for (const k of KINDS) {
      expect(organismName(k)).toBeTruthy();
      expect(organismShort(k)).toBeTruthy();
      expect(organismDescription(k)).toBeTruthy();
    }
    expect(organismName("strep")).toBe("Streptococcus");
    expect(organismName("staph")).toBe("Staphylococcus");
    expect(organismName("aspergillus")).toBe("Aspergillus");
    expect(organismScientific("staph")).toBe("Staphylococcus aureus");
    expect(organismShort("staph")).toBe("Staph");
  });

  it("counts without a plural s", () => {
    expect(organismCount("staph", 1)).toBe("1 Staphylococcus");
    expect(organismCount("strep", 2)).toBe("2 Streptococcus");
    expect(organismCountShort("strep", 2)).toBe("2 Strep");
  });

  it("describes for cards, keys and screen readers", () => {
    expect(organismAria("aspergillus")).toBe(
      "Aspergillus, a mold in a shell, found in soil and compost",
    );
    expect(organismSub("staph")).toBe(
      "Staphylococcus aureus, a round bacterium in a shell",
    );
    expect(organismKeyText("strep")).toBe("Streptococcus, a bacterium");
    expect(organismKeyText("aspergillus")).toBe("Aspergillus, a mold");
  });

  it("lists names", () => {
    expect(organismList([])).toBe("");
    expect(organismList(["strep"])).toBe("Streptococcus");
    expect(organismList(["strep", "staph"])).toBe(
      "Streptococcus and Staphylococcus",
    );
    expect(organismList(["strep", "staph", "aspergillus"])).toBe(
      "Streptococcus, Staphylococcus and Aspergillus",
    );
  });

  it("has grouping words", () => {
    expect(formNoun("bacterium")).toBe("bacterium");
    expect(formNoun("bacterium", true)).toBe("bacteria");
    expect(formNoun("mold")).toBe("mold");
    expect(chargeTargets.antifungal).toBe("molds");
  });
});
