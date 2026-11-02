import { describe, expect, it } from "vitest";
import type { CycleResult } from "./campaign";
import { createLife, placeCard } from "./life/calendar";
import type {
  CardId,
  Dose,
  DoctorVisit,
  ExposureRoll,
  LifeState,
  Symptom,
} from "./life/types";
import { cardDef } from "./life/cards";
import { PARAMS } from "./params";
import type { BattleGrade, BattleKind } from "./types";
import {
  campaignScore,
  cardChoices,
  plannedChoices,
  weekChoices,
  weekOutcome,
  weekScore,
} from "./score";

// Hand-built weeks: a fresh life with the finished-week fields overridden.

const roll = (card: CardId): ExposureRoll => ({
  day: 0,
  slot: 0,
  card,
  kind: cardDef(card).exposure.kind,
  chance: cardDef(card).exposure.chance,
  roll: 0.99,
  landed: false,
});

const dose = (day: number, taken: boolean, week = 1): Dose => ({
  week,
  day,
  taken,
  cause: taken ? "tapped" : "skipped",
});

const week = (over: Partial<LifeState> = {}): LifeState => ({
  ...createLife({ seed: 1 }),
  goal: { points: 0, target: PARAMS.life.goalTarget },
  ...over,
});

const visit = (
  timing: "early" | "late",
  finding: "reservoir" | "viral",
): DoctorVisit => ({ day: 1, slot: 0, timing, finding, energy: 0 });

const fever: Symptom = { kind: "lowFever", day: 0 };

const battle = (
  grade: BattleGrade,
  health: number,
  battleKind: BattleKind = "full",
): CycleResult => ({
  kind: "battle",
  battleKind,
  reasons: [],
  outcome: {
    grade,
    backupReasons: [],
    freePathogens: 0,
    reservoirs: [],
    tissue: {
      health,
      max: PARAMS.maxTissueHealth,
      lost: PARAMS.maxTissueHealth - health,
    },
    energy: 0,
    turnsPlayed: 0,
  },
});

describe("Choices", () => {
  it("pays ten per life point", () => {
    expect(weekChoices(week({ goal: { points: 12, target: 12 } })).living).toBe(
      120,
    );
  });

  it("pays the avoided chance for a smarter card, nothing for a risky one", () => {
    expect(weekChoices(week({ rolls: [roll("yardIndoor")] })).dodged).toBe(35);
    expect(weekChoices(week({ rolls: [roll("beach")] })).dodged).toBe(30);
    expect(
      weekChoices(week({ rolls: [roll("yard"), roll("lake"), roll("band")] }))
        .dodged,
    ).toBe(0);
    expect(
      weekChoices(week({ rolls: [roll("yardIndoor"), roll("beach")] })).dodged,
    ).toBe(65);
  });

  it("pays ten per dose taken this week and drops ten per skipped dose", () => {
    const pre = dose(2, true, 0);
    const taken = week({
      doses: [pre, dose(0, true), dose(1, true), dose(2, true)],
    });
    const skipped = week({
      doses: [pre, dose(0, true), dose(1, false), dose(2, true)],
    });
    expect(weekChoices(taken).meds).toBe(30);
    expect(weekChoices(skipped).meds).toBe(20);
  });

  it("pays for checking a symptom, early more than late, a viral visit the same", () => {
    const base = { symptoms: [fever] };
    expect(
      weekChoices(week({ ...base, doctor: visit("early", "reservoir") }))
        .checked,
    ).toBe(20);
    expect(
      weekChoices(week({ ...base, doctor: visit("early", "viral") })).checked,
    ).toBe(20);
    expect(
      weekChoices(week({ ...base, doctor: visit("late", "reservoir") }))
        .checked,
    ).toBe(10);
    expect(weekChoices(week(base)).checked).toBe(0);
    expect(weekChoices(week({ doctor: visit("early", "viral") })).checked).toBe(
      0,
    );
  });

  it("sums its parts", () => {
    const c = weekChoices(
      week({
        goal: { points: 10, target: 12 },
        rolls: [roll("yardIndoor")],
        symptoms: [fever],
        doctor: visit("early", "reservoir"),
        doses: [dose(0, true), dose(1, true), dose(2, true)],
      }),
    );
    expect(c).toEqual({
      living: 100,
      dodged: 35,
      meds: 30,
      checked: 20,
      total: 185,
    });
  });
});

describe("Outcome", () => {
  it("scores a quiet week 100 with nothing carried", () => {
    expect(weekOutcome({ kind: "quiet" }, 0)).toEqual({
      tissue: 40,
      fight: 40,
      clear: 20,
      total: 100,
    });
  });

  it("scores full battles by grade and tissue kept", () => {
    expect(weekOutcome(battle("cleared", 20), 0).total).toBe(100);
    expect(weekOutcome(battle("contained", 15), 0)).toMatchObject({
      tissue: 30,
      fight: 20,
    });
    expect(weekOutcome(battle("neededBackup", 8), 0)).toMatchObject({
      tissue: 16,
      fight: 10,
    });
  });

  it("scores a skirmish cleared or loose", () => {
    expect(weekOutcome(battle("cleared", 20, "skirmish"), 0).fight).toBe(40);
    expect(weekOutcome(battle("neededBackup", 20, "skirmish"), 0).fight).toBe(
      20,
    );
  });

  it("takes ten off the clear part per carried reservoir, never below zero", () => {
    const r = battle("contained", 20);
    expect(weekOutcome(r, 1).clear).toBe(10);
    expect(weekOutcome(r, 2).clear).toBe(0);
    expect(weekOutcome(r, 5).clear).toBe(0);
  });
});

describe("week and campaign totals", () => {
  it("adds Choices and Outcome", () => {
    const w = weekScore(
      week({ goal: { points: 5, target: 12 } }),
      { kind: "quiet" },
      0,
    );
    expect(w.total).toBe(w.choices.total + w.outcome.total);
    expect(w.version).toBe(PARAMS.score.version);
  });

  it("sums weeks into Choices, Outcome and a total", () => {
    const a = weekScore(
      week({ goal: { points: 10, target: 12 } }),
      battle("cleared", 20),
      0,
    );
    const b = weekScore(
      week({ goal: { points: 4, target: 12 } }),
      { kind: "quiet" },
      1,
    );
    const t = campaignScore([a, b]);
    expect(t.choices).toBe(a.choices.total + b.choices.total);
    expect(t.outcome).toBe(a.outcome.total + b.outcome.total);
    expect(t.total).toBe(t.choices + t.outcome);
  });

  it("has no negative part on any input", () => {
    const w = weekScore(week(), battle("neededBackup", 0), 9);
    for (const n of [
      ...Object.values(w.choices),
      ...Object.values(w.outcome),
      w.total,
    ])
      expect(n).toBeGreaterThanOrEqual(0);
  });
});

describe("plannedChoices", () => {
  it("counts an empty fresh week as its default doses only", () => {
    const p = plannedChoices(createLife({ seed: 1 }));
    expect(p.living).toBe(0);
    expect(p.dodged).toBe(0);
    expect(p.meds).toBe(PARAMS.score.perDose * PARAMS.life.days);
    expect(p.total).toBe(p.meds);
  });

  it("adds placed cards: points and the odds a smarter version pushes", () => {
    let l = createLife({ seed: 1 });
    l = placeCard(l, 0, 0, "yardIndoor", false).state;
    const p = plannedChoices(l);
    expect(p.living).toBe(PARAMS.score.perPoint * cardDef("yardIndoor").points);
    expect(p.dodged).toBe(35);
    expect(p.total).toBe(p.living + p.dodged + p.meds + p.checked);
  });

  it("matches weekChoices once nothing is left to play", () => {
    const done = week({
      day: PARAMS.life.days,
      goal: { points: 11, target: PARAMS.life.goalTarget },
      doses: [dose(0, true), dose(1, false), dose(2, true)],
    });
    expect(plannedChoices(done)).toEqual(weekChoices(done));
  });
});

describe("cardChoices", () => {
  it("is points only for a base card", () => {
    expect(cardChoices("yard")).toEqual({ living: 40, dodged: 0, total: 40 });
    expect(cardChoices("lake")).toEqual({ living: 50, dodged: 0, total: 50 });
  });

  it("adds the landing chance a smarter version avoids", () => {
    expect(cardChoices("yardIndoor")).toEqual({
      living: 30,
      dodged: 35,
      total: 65,
    });
    expect(cardChoices("beach")).toEqual({ living: 40, dodged: 30, total: 70 });
  });

  it("keeps the risky version's life points above the smarter one's", () => {
    expect(cardChoices("yard").living).toBeGreaterThan(
      cardChoices("yardIndoor").living,
    );
    expect(cardChoices("lake").living).toBeGreaterThan(
      cardChoices("beach").living,
    );
  });

  it("is nothing for the doctor card", () => {
    expect(cardChoices("doctor").total).toBe(0);
  });
});
