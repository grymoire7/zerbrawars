import { describe, expect, it } from "vitest";
import { advanceDay, createLife, placeCard } from "../sim/life/calendar";
import type { LifeState } from "../sim/life/types";
import {
  doseStrip,
  friendlyProblem,
  lifeBeats,
  oddsText,
  particleCount,
  placementCheck,
  weekSummary,
} from "./lifeModel";

const put = (
  l: LifeState,
  d: number,
  s: number,
  c: Parameters<typeof placeCard>[3],
  p = false,
) => placeCard(l, d, s, c, p).state;

describe("oddsText", () => {
  it("states the chance in words", () => {
    expect(oddsText(0.45, "aspergillus")).toBe("45% chance of a mold exposure");
    expect(oddsText(0.15, "strep")).toBe("15% chance of a bacterial exposure");
  });
});

describe("particleCount", () => {
  it("scales with expected pathogens, so the smarter version brings fewer", () => {
    expect(particleCount(0.9)).toBeGreaterThan(particleCount(0.15));
    expect(particleCount(0)).toBe(0);
    expect(particleCount(0.001)).toBe(1);
    expect(particleCount(50)).toBeLessThanOrEqual(40);
  });
});

describe("friendlyProblem", () => {
  it("rewords sim problems and passes unknown ones through", () => {
    expect(friendlyProblem("not enough energy")).toMatch(/energy/);
    expect(friendlyProblem("lake is already on day 1")).toBe(
      "Already planned for day 2",
    );
    expect(friendlyProblem("odd")).toBe("odd");
  });
});

describe("placementCheck", () => {
  it("lets a planned card move, and blocks a sleepover on the last day", () => {
    let l = createLife({ seed: 1 });
    l = put(l, 0, 0, "band");
    expect(placementCheck(l, 1, 0, "band", false).ok).toBe(true);
    const bad = placementCheck(l, 2, 1, "sleepover", false);
    expect(bad.ok).toBe(false);
    expect(bad.reasons[0]).toMatch(/sleepover/i);
  });
});

describe("doseStrip", () => {
  it("shows the friction day lost with its reason", () => {
    let l = createLife({ seed: 1 });
    l = put(l, 0, 1, "sleepover", false);
    const strip = doseStrip(l);
    expect(strip).toHaveLength(3);
    expect(strip[1]).toMatchObject({
      taken: false,
      why: "pills in the other bag",
    });
    expect(strip[2].level).toBeLessThan(1);
  });
});

describe("lifeBeats and weekSummary", () => {
  it("narrates a day and sums the week", () => {
    let l = createLife({ seed: 3 });
    l = put(l, 0, 0, "lake");
    const step = advanceDay(l);
    const lines = lifeBeats(step.events);
    expect(lines.some((t) => t.includes("The lake with Jordan"))).toBe(true);
    expect(lines.some((t) => /chance/.test(t))).toBe(true);
    const s = weekSummary(step.state);
    expect(s.points).toBe(5);
    expect(s.dodged + s.landed.length).toBe(1);
  });
});
