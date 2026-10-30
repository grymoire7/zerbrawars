import { describe, expect, it } from "vitest";
import { PARAMS } from "../params";
import { firstBoardLoadout } from "../scenarios";
import type { BattleState, Intent } from "../types";
import { stallChance, telegraph } from "./intents";
import { resolveTurn } from "./resolve";
import { battleFromLoadout } from "./setup";

const at = (seed: number, medLevel: number) =>
  battleFromLoadout(firstBoardLoadout(seed, medLevel));

/** Every intent of zero-order battles over `seeds` seeds and up to 6 turns. */
function intents(medLevel: number, seeds = 300): Intent[] {
  const all: Intent[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    let b: BattleState = at(seed, medLevel);
    for (let t = 0; t < 6; t++) {
      all.push(...b.intents);
      const r = resolveTurn(b);
      if (r.status.over) break;
      b = r.state;
    }
  }
  return all;
}

const stallShare = (xs: Intent[]) =>
  xs.filter((i) => i.type === "stall").length / xs.length;

describe("medication aura", () => {
  it("scales the stall chance with the aura and never reaches 1", () => {
    expect(stallChance(0)).toBe(0);
    expect(stallChance(1)).toBe(PARAMS.meds.auraStallChance);
    expect(stallChance(0.5)).toBeCloseTo(PARAMS.meds.auraStallChance / 2);
    expect(stallChance(2)).toBe(PARAMS.meds.auraStallChance);
    expect(PARAMS.meds.auraStallChance).toBeLessThan(1);
  });

  it("stalls nothing at med 0 and about auraStallChance of intents at full meds", () => {
    expect(stallShare(intents(0))).toBe(0);
    const full = stallShare(intents(1));
    expect(full).toBeGreaterThan(PARAMS.meds.auraStallChance - 0.04);
    expect(full).toBeLessThan(PARAMS.meds.auraStallChance + 0.04);
  });

  it("slows growth but never stops it", () => {
    const grows = (level: number) =>
      intents(level).filter((i) => i.type !== "stall").length;
    expect(grows(1)).toBeGreaterThan(0);
    expect(grows(1)).toBeLessThan(grows(0));
  });

  it("stalls a superset of pathogens on the first roll as the aura rises", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const stalled = (level: number) =>
        at(seed, level)
          .intents.filter((i) => i.type === "stall")
          .map((i) => i.pathogenId);
      // Only the first pathogen's stall roll sits at the same stream position for every level.
      const first = (level: number) => stalled(level).includes("p1");
      if (first(0.5)) expect(first(1)).toBe(true);
    }
  });

  it("telegraphs a stall as no change, and resolves it with no event", () => {
    let found = false;
    for (let seed = 1; seed <= 50 && !found; seed++) {
      const b = at(seed, 1);
      const stall = b.intents.find((i) => i.type === "stall");
      if (!stall) continue;
      found = true;
      const p = b.pathogens.find((q) => q.id === stall.pathogenId);
      const mark = telegraph(b).find((m) => m.pathogenId === stall.pathogenId);
      expect(mark).toMatchObject({
        type: "stall",
        to: null,
        sizeAfter: p?.size,
        childSize: 0,
      });
      const { state, events } = resolveTurn(b);
      expect(state.pathogens.find((q) => q.id === p?.id)).toEqual(p);
      expect(
        events.some((e) => "pathogenId" in e && e.pathogenId === p?.id),
      ).toBe(false);
    }
    expect(found).toBe(true);
  });
});
