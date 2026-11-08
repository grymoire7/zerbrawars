import { describe, expect, it } from "vitest";
import { PARAMS } from "../sim/params";
import { ARCS, VARIANTS } from "./arcs";
import {
  arcChoices,
  bestsText,
  completeButtons,
  continueChoice,
  heldLine,
  needsReplaceConfirm,
  resumeTarget,
  isDebugStart,
  parseStart,
  pickerChoices,
  variantChoices,
} from "./arcModel";
import type { BestEntry } from "./bestScores";
import { createRun } from "./run";

const entry = (total: number): BestEntry => ({
  total,
  choices: total - 10,
  outcome: 10,
  runs: 1,
  at: "2026-11-06T00:00:00.000Z",
});
const q = (s: string) => new URLSearchParams(s);

describe("arcs data", () => {
  it("are numbered in order and unique", () => {
    expect(ARCS.map((a) => a.number)).toEqual([1, 2]);
    expect(new Set(ARCS.map((a) => a.id)).size).toBe(ARCS.length);
  });
  it("arc 1 is a single battle and arc 2 is the campaign", () => {
    expect(ARCS[0]!.play.kind).toBe("battle");
    expect(ARCS[1]!.play.kind).toBe("campaign");
  });
});

describe("variants", () => {
  it("offers both CGD variants, each leading to the arc picker", () => {
    expect(variantChoices().map((c) => c.label)).toEqual([
      "CGD, X-linked",
      "CGD, autosomal recessive",
    ]);
    expect(variantChoices()[1]!.to).toEqual({ mode: "arcs", variant: "ar" });
    expect(VARIANTS).toHaveLength(2);
  });
  it("sets the run's residual kill chance, XL being the default", () => {
    expect(PARAMS.residualByVariant.xl).toBe(PARAMS.residualKillChance);
    const xl = createRun({ seed: 1 });
    const ar = createRun({ seed: 1, variant: "ar" });
    expect(xl.campaign().residualKillChance).toBe(PARAMS.residualKillChance);
    expect(ar.campaign().residualKillChance).toBe(PARAMS.residualByVariant.ar);
    expect(ar.campaign().residualKillChance).toBeGreaterThan(
      xl.campaign().residualKillChance,
    );
    expect(ar.variant).toBe("ar");
    expect(xl.arc).toBe("summer");
  });
});

describe("arcChoices", () => {
  it("lists both arcs, with bests only on the campaign", () => {
    const list = [
      { id: "1|summer|xl|7", entry: entry(60) },
      { id: "1|summer|xl|1", entry: entry(80) },
    ];
    const c = arcChoices("xl", list);
    expect(c[0]!.to).toEqual({
      mode: "arcPlay",
      arc: "tutorial",
      variant: "xl",
    });
    expect(c[0]!.lines).toEqual([]);
    expect(c[1]!.lines[0]).toBe("Best scores");
    expect(c[1]!.lines[1]).toContain(" points (Choices");
  });
  it("says so when there is no score yet", () => {
    expect(arcChoices("ar", [])[1]!.lines).toHaveLength(1);
  });
});

describe("bestsText", () => {
  it("keeps this arc only and caps the list", () => {
    const list = [
      { id: "1|tutorial|xl|1", entry: entry(99) },
      ...[1, 2, 3, 4].map((n) => ({ id: `1|summer|xl|${n}`, entry: entry(n) })),
    ];
    const t = bestsText("summer", "xl", list);
    expect(t).toHaveLength(3);
    expect(t[0]).toBe("1 points (Choices -9, Outcome 10)");
  });
});

describe("completeButtons", () => {
  it("replays a summer with its seed and offers a new game", () => {
    const b = completeButtons("summer", "xl", 7, () => 42);
    expect(b.map((x) => x.label)).toEqual([
      "Replay",
      "New game",
      "Choose another arc",
      "Change character",
    ]);
    expect(b[0]!.to).toEqual({
      mode: "arcPlay",
      arc: "summer",
      variant: "xl",
      seed: 7,
    });
    expect(b[1]!.to).toEqual({
      mode: "arcPlay",
      arc: "summer",
      variant: "xl",
      seed: 42,
    });
  });
  it("replays, goes back to the arcs or to the title", () => {
    const b = completeButtons("tutorial", "ar");
    expect(b.map((x) => x.label)).toEqual([
      "Replay",
      "Choose another arc",
      "Change character",
    ]);
    expect(b[0]!.to).toEqual({
      mode: "arcPlay",
      arc: "tutorial",
      variant: "ar",
    });
    expect(b[1]!.to).toEqual({ mode: "arcs", variant: "ar" });
    expect(b[2]!.to).toEqual({ mode: "title" });
  });
});

describe("parseStart", () => {
  it("boots to the title with no relevant parameters", () => {
    expect(parseStart(q(""))).toEqual({ kind: "title" });
    expect(parseStart(q("foo=1"))).toEqual({ kind: "title" });
  });
  it("keeps every debug entry out of the title", () => {
    for (const s of [
      "mode=life",
      "mode=battle",
      "seed=5",
      "reservoirs=staph:2",
      "med=0.5",
      "goal=10",
      "scenario=first-board",
    ])
      expect(parseStart(q(s))).toEqual({ kind: "debug" });
  });
  it("starts an arc or opens the picker from ?arc and ?variant", () => {
    expect(parseStart(q("arc=1"))).toEqual({
      kind: "arc",
      arc: "tutorial",
      variant: "xl",
    });
    expect(parseStart(q("arc=2&variant=ar"))).toEqual({
      kind: "arc",
      arc: "summer",
      variant: "ar",
    });
    expect(parseStart(q("variant=ar"))).toEqual({
      kind: "arcs",
      variant: "ar",
    });
    expect(parseStart(q("variant=ar&seed=3"))).toEqual({ kind: "debug" });
  });
});

describe("held summer", () => {
  const camp = () => createRun({ seed: 3, now: () => 0 }).campaign();

  it("says the week and day in plain words", () => {
    const c = camp();
    expect(heldLine(c, "xl")).toBe("Week 1 of 2, day 1 · CGD, X-linked");
    const later = { ...c, life: { ...c.life, day: 2 } };
    expect(heldLine(later, "ar")).toBe(
      "Week 1 of 2, day 3 · CGD, autosomal recessive",
    );
  });
  it("says the end of the week once every day is played", () => {
    const c = camp();
    const over = { ...c, life: { ...c.life, day: PARAMS.life.days } };
    expect(heldLine(over, "xl")).toMatch(/^Week 1 of 2, the end of the week/);
  });
  it("names a waiting fight and a finished one", () => {
    const c = camp();
    expect(heldLine({ ...c, mode: "battle" }, "xl")).toMatch(
      /a fight is waiting/,
    );
    expect(heldLine({ ...c, mode: "outcome" }, "xl")).toMatch(
      /after the week's fight/,
    );
  });
  it("offers Continue only with a held run", () => {
    expect(continueChoice(null)).toBeNull();
    const item = continueChoice({ campaign: camp(), variant: "xl" });
    expect(item?.label).toBe("Continue your summer");
    expect(item?.to).toEqual({ mode: "continue" });
    expect(item?.sub).toMatch(/Week 1 of 2/);
  });
  it("puts Continue first in the arc picker only with a held run", () => {
    const plain = pickerChoices("xl", null, []);
    expect(plain.map((c) => c.label)).toEqual(
      arcChoices("xl", []).map((c) => c.label),
    );
    const held = pickerChoices("xl", { campaign: camp(), variant: "ar" }, []);
    expect(held).toHaveLength(plain.length + 1);
    expect(held[0]).toEqual(
      continueChoice({ campaign: camp(), variant: "ar" }),
    );
    expect(held[0]?.to).toEqual({ mode: "continue" });
    expect(needsReplaceConfirm(held[0]?.to, true)).toBe(false);
    expect(needsReplaceConfirm(held[2]?.to, true)).toBe(true);
  });
  it("resumes on the screen the campaign mode names", () => {
    const c = camp();
    expect(resumeTarget(c)).toBe("life");
    expect(resumeTarget({ ...c, mode: "battle" })).toBe("battle");
    expect(
      resumeTarget({ ...c, mode: "outcome", result: { kind: "quiet" } }),
    ).toBe("quiet");
    expect(resumeTarget({ ...c, mode: "outcome", result: null })).toBe(
      "battle",
    );
    expect(resumeTarget({ ...c, mode: "done" })).toBe("summary");
  });
  it("asks before replacing a summer, only for a summer", () => {
    const summer = { mode: "arcPlay", arc: "summer", variant: "xl" } as const;
    const fight = { mode: "arcPlay", arc: "tutorial", variant: "xl" } as const;
    expect(needsReplaceConfirm(summer, true)).toBe(true);
    expect(needsReplaceConfirm(summer, false)).toBe(false);
    expect(needsReplaceConfirm(fight, true)).toBe(false);
    expect(needsReplaceConfirm({ mode: "title" }, true)).toBe(false);
    expect(needsReplaceConfirm(undefined, true)).toBe(false);
  });
});

describe("isDebugStart", () => {
  it("is true for the developer levers, even beside an arc", () => {
    for (const s of [
      "mode=life",
      "seed=3",
      "arc=2&seed=3",
      "med=0.5",
      "goal=4",
    ])
      expect(isDebugStart(q(s))).toBe(true);
  });
  it("is false for a patient's start, with or without the facilitator flag", () => {
    for (const s of [
      "",
      "arc=2",
      "variant=ar",
      "facilitator=1",
      "facilitator=1&arc=2",
    ])
      expect(isDebugStart(q(s))).toBe(false);
  });
});
