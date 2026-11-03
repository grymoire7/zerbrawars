import { describe, expect, it } from "vitest";
import { BOTS, playBattle } from "./battle/bots";
import { battleStatus } from "./battle/outcome";
import { resolveTurn } from "./battle/resolve";
import { battleFromLoadout } from "./battle/setup";
import {
  battleTurn,
  carryPreview,
  carryReservoirs,
  createCampaign,
  endWeek,
  lifeAction,
  nextCycle,
  syncBattle,
  type Campaign,
  type CampaignEvent,
  type CampaignOptions,
  type CampaignStep,
} from "./campaign";
import {
  CAMPAIGN_BOTS,
  playCampaign,
  playLifeWeek,
  thoughtfulPlay,
} from "./campaignBots";
import {
  doctorCost,
  doctorPreview,
  flareChance,
  viralFeverDay,
} from "./life/body";
import {
  advanceDay,
  createLife,
  placeCard,
  placementProblems,
  weekOver,
} from "./life/calendar";
import {
  battleDue,
  loadoutFromLife,
  type CarriedReservoir,
} from "./life/loadout";
import type { LifeEvent, LifeState } from "./life/types";
import { PARAMS } from "./params";
import { wallOf } from "./pathogens";
import {
  appendEntry,
  createSessionLog,
  exportSessionLog,
  logStep,
  parseSessionLog,
  type SessionLog,
} from "./sessionLog";
import type { BattleState } from "./types";
import { validateCampaign, validateLife } from "./validate";

const C = PARAMS.campaign;
const MOLD2: CarriedReservoir = { kind: "aspergillus", size: 2, hidden: true };
const STAPH1: CarriedReservoir = { kind: "staph", size: 1, hidden: true };

const finish = (life: LifeState): LifeState => {
  while (!weekOver(life)) life = advanceDay(life).state;
  return life;
};

function eventsOf(life: LifeState): { state: LifeState; events: LifeEvent[] } {
  const events: LifeEvent[] = [];
  while (!weekOver(life)) {
    const r = advanceDay(life);
    life = r.state;
    events.push(...r.events);
  }
  return { state: life, events };
}

/** A seed whose week `week` has no viral fever (so symptoms come from reservoirs only). */
function seedWithoutVirus(week = 1, from = 1): number {
  let seed = from;
  while (viralFeverDay(seed, week) !== null) seed++;
  return seed;
}

describe("staph and the lake", () => {
  it("brings a strep and a staph when the lake lands", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const life = finish(placeCard(createLife({ seed }), 1, 0, "lake").state);
      if (life.exposures.length === 0) continue;
      expect(life.exposures.map((e) => e.kind)).toEqual(["strep", "staph"]);
      const battle = battleFromLoadout(loadoutFromLife(life));
      expect(battle.pathogens.map((p) => p.kind)).toEqual(["strep", "staph"]);
      return;
    }
    throw new Error("no lake exposure landed in 50 seeds");
  });
});

describe("symptoms", () => {
  it("shows a size-2 mold as a fever on day 0 and puts the doctor in hand", () => {
    const seed = seedWithoutVirus();
    const life = createLife({ seed, reservoirs: [MOLD2] });
    expect(life.symptoms).toEqual([{ kind: "lowFever", day: 0 }]);
    expect(life.hand).toContain("doctor");
    expect(life.reservoirs[0]).toMatchObject({ symptomDay: 0, flared: false });
    expect(validateLife(life)).toEqual([]);
  });

  it("shows a size-1 staph as a sore spot on day 1, not before", () => {
    const seed = seedWithoutVirus();
    const life = createLife({ seed, reservoirs: [STAPH1] });
    expect(life.symptoms).toEqual([]);
    expect(life.hand).not.toContain("doctor");
    expect(placementProblems(life, 0, 0, "doctor")).toContain(
      "doctor is not in hand",
    );
    const r = advanceDay(life);
    expect(r.events).toContainEqual({
      type: "SymptomAppeared",
      symptom: { kind: "soreSpot", day: 1 },
    });
    expect(r.state.hand).toContain("doctor");
  });

  it("starts the week tired when the carried total is big enough", () => {
    const seed = seedWithoutVirus();
    const life = createLife({
      seed,
      energy: 6,
      reservoirs: [MOLD2, { kind: "staph", size: 2, hidden: true }],
    });
    expect(life.symptoms.map((s) => s.kind)).toEqual([
      "lowFever",
      "soreSpot",
      "tired",
    ]);
    expect(life.energy).toBe(6 - C.symptoms.tiredEnergy);
  });

  it("brings a viral fever in some weeks with no reservoir at all", () => {
    let viral = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const day = viralFeverDay(seed, 1);
      if (day === null) continue;
      viral++;
      const { state } = eventsOf(createLife({ seed }));
      expect(state.symptoms).toEqual([{ kind: "lowFever", day }]);
    }
    expect(viral / 400).toBeCloseTo(C.symptoms.viralChance, 1);
  });
});

describe("growth and flares", () => {
  it("grows an untreated reservoir once, at the end of its early window", () => {
    const seed = seedWithoutVirus();
    const { state, events } = eventsOf(
      createLife({ seed, reservoirs: [MOLD2] }),
    );
    const grew = events.filter((e) => e.type === "ReservoirGrew");
    expect(grew).toEqual([
      { type: "ReservoirGrew", day: C.doctor.earlyDays, index: 0, size: 3 },
    ]);
    expect(state.reservoirs[0]).toMatchObject({ size: 3, grown: true });
  });

  it("grows the flare chance each day and with size", () => {
    expect(flareChance(0, 1)).toBeCloseTo(C.flare.perDay);
    expect(flareChance(2, 1)).toBeCloseTo(3 * C.flare.perDay);
    expect(flareChance(1, 3)).toBeCloseTo(
      2 * C.flare.perDay + 2 * C.flare.perSize,
    );
  });

  it("flares about as often as the odds say, and a quiet week keeps it hidden", () => {
    // A size-2 mold: size 2 on days 0 and 1, then 3 after growing at the end of day 1.
    const expected =
      1 -
      (1 - flareChance(0, 2)) *
        (1 - flareChance(1, 3)) *
        (1 - flareChance(2, 3));
    let flared = 0;
    const N = 600;
    for (let seed = 1; seed <= N; seed++) {
      const life = finish(createLife({ seed, reservoirs: [MOLD2] }));
      const r = life.reservoirs[0];
      if (r.flared) flared++;
      expect(battleDue(life).battleKind).toBe(r.flared ? "full" : "skirmish");
      // A skirmish leaves it off the board, still hidden, to carry on.
      if (r.flared)
        expect(loadoutFromLife(life).reservoirs[0].hidden).toBe(false);
      else expect(life.reservoirs[0].hidden).toBe(true);
    }
    expect(flared / N).toBeCloseTo(expected, 1);
  });
});

describe("the doctor", () => {
  const seed = seedWithoutVirus();
  const start = createLife({ seed, energy: 4, reservoirs: [MOLD2] });

  it("is early and restful within the window, late and dearer after it", () => {
    expect(doctorPreview(start, 0)).toMatchObject({
      available: true,
      timing: "early",
      energy: C.doctor.earlyEnergy,
      earlyUntil: C.doctor.earlyDays,
    });
    expect(doctorPreview(start, 2)).toMatchObject({
      timing: "late",
      energy: C.doctor.lateEnergy,
    });
    expect(doctorPreview(start).charges.strong).toBe(
      PARAMS.meds.doctorStrongCharges,
    );
  });

  it("early: reveals, stops growth and flares, and makes the battle due", () => {
    const placed = placeCard(start, 0, 0, "doctor").state;
    const { state, events } = eventsOf(placed);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "DoctorVisited",
        timing: "early",
        finding: "reservoir",
        revealed: 1,
      }),
    );
    expect(events.some((e) => e.type === "ReservoirGrew")).toBe(false);
    expect(events.some((e) => e.type === "ReservoirFlared")).toBe(false);
    expect(state.reservoirs[0]).toMatchObject({ size: 2, hidden: false });
    expect(battleDue(state).reasons).toEqual(["doctor"]);
    const battle = battleFromLoadout(loadoutFromLife(state));
    expect(battle.pathogens.every((p) => !p.hidden)).toBe(true);
    expect(battle.meds.charges.strong).toBe(PARAMS.meds.doctorStrongCharges);
  });

  it("late: still reveals, but the reservoir grew and it cost energy", () => {
    const placed = placeCard(start, 2, 0, "doctor").state;
    const { state, events } = eventsOf(placed);
    const visit = events.find((e) => e.type === "DoctorVisited");
    expect(visit).toMatchObject({
      timing: "late",
      energy: C.doctor.lateEnergy,
    });
    expect(state.reservoirs[0]).toMatchObject({ size: 3, hidden: false });
    expect(battleDue(state).reasons).toContain("doctor");
    expect(doctorCost(placed, 2)).toBeGreaterThan(doctorCost(placed, 0));
  });

  it("viral: says so, gives energy back and calls no battle, not even a skirmish", () => {
    let s = 1;
    while (viralFeverDay(s, 1) !== 0) s++;
    const life = createLife({ seed: s, energy: 3 });
    expect(life.symptoms).toEqual([{ kind: "lowFever", day: 0 }]);
    const r = advanceDay(placeCard(life, 0, 0, "doctor").state);
    const visit = r.events.find((e) => e.type === "DoctorVisited");
    expect(visit).toMatchObject({ finding: "viral", revealed: 0 });
    // Never costlier than resting: the early visit plus the viral refund.
    const restOnly = advanceDay(life).state.energy;
    expect(r.state.energy).toBeGreaterThanOrEqual(restOnly);
    expect(battleDue(finish(r.state)).due).toBe(false);
  });
});

describe("carrying reservoirs", () => {
  it("keeps the two biggest, cut to the carry size and hidden, and drops the rest", () => {
    const { kept, dropped } = carryReservoirs([
      { kind: "staph", size: 1 },
      { kind: "aspergillus", size: 3 },
      { kind: "staph", size: 2 },
      { kind: "aspergillus", size: 2 },
    ]);
    expect(kept).toEqual([
      { kind: "aspergillus", size: C.carry.maxSize, hidden: true },
      { kind: "staph", size: 2, hidden: true },
    ]);
    expect(dropped).toEqual([
      { kind: "aspergillus", size: 2 },
      { kind: "staph", size: 1 },
    ]);
    expect(kept).toHaveLength(C.carry.maxReservoirs);
  });
});

/** Steps a campaign, checking it is valid and survives JSON after every transition. */
function check(step: CampaignStep): Campaign {
  expect(validateCampaign(step.state)).toEqual([]);
  expect(JSON.parse(JSON.stringify(step.state))).toEqual(step.state);
  return step.state;
}

const types = (events: readonly CampaignEvent[]) => events.map((e) => e.type);

describe("campaign transitions", () => {
  it("starts in the life phase of week 1", () => {
    const step = createCampaign({ seed: 3 });
    const c = check(step);
    expect(c).toMatchObject({ mode: "life", cycle: 1, cycles: C.cycles });
    expect(step.events[0]).toMatchObject({ type: "WeekStarted", cycle: 1 });
    expect(() => endWeek(c)).toThrow(/not over/);
    expect(() => nextCycle(c)).toThrow(/outcome mode/);
    expect(() => battleTurn(c, [])).toThrow(/battle mode/);
  });

  it("goes quiet only after a viral doctor visit, and carries the energy", () => {
    let seed = 1;
    while (viralFeverDay(seed, 1) !== 0) seed++;
    let c = check(createCampaign({ seed }));
    c = check(lifeAction(c, (l) => placeCard(l, 0, 0, "doctor")));
    while (!weekOver(c.life)) c = check(lifeAction(c, advanceDay));
    const left = c.life.energy;
    const quiet = endWeek(c);
    c = check(quiet);
    expect(quiet.events).toEqual([
      { type: "QuietWeek", cycle: 1, reason: "viral" },
    ]);
    expect(c).toMatchObject({
      mode: "outcome",
      result: { kind: "quiet" },
      battle: null,
      battleKind: null,
    });
    expect(carryPreview(c).energy.next).toBe(
      Math.min(
        PARAMS.life.maxEnergy,
        left + C.weekRecovery + C.quietWeekEnergy,
      ),
    );
    const next = nextCycle(c);
    c = check(next);
    expect(types(next.events).slice(0, 2)).toEqual(["Carried", "WeekStarted"]);
    expect(c).toMatchObject({ mode: "life", cycle: 2, battleKind: null });
    expect(c.life.week).toBe(2);
    expect(c.history[0].result).toEqual({ kind: "quiet" });
  });

  it("plays a due battle turn by turn into its outcome, then ends after the last week", () => {
    let seed = 1;
    let c: Campaign;
    for (;;) {
      c = playLifeWeek(
        createCampaign({ seed, cycles: 1 }).state,
        CAMPAIGN_BOTS.risky(() => 0),
      );
      if (battleDue(c.life).battleKind === "full") break;
      seed++;
    }
    const start = endWeek(c);
    c = check(start);
    expect(c.mode).toBe("battle");
    expect(start.events[0]).toMatchObject({
      type: "BattleStarted",
      battleKind: "full",
      reasons: ["exposure"],
    });
    expect(c.battleKind).toBe("full");
    expect(() => lifeAction(c, advanceDay)).toThrow(/life mode/);
    let ended: CampaignStep | null = null;
    while (c.mode === "battle") {
      const step = battleTurn(c, []);
      c = check(step);
      if (c.mode === "outcome") ended = step;
    }
    expect(ended?.events.at(-1)).toMatchObject({
      type: "BattleEnded",
      battleKind: "full",
    });
    expect(c.result?.kind).toBe("battle");
    const done = nextCycle(c);
    c = check(done);
    expect(c.mode).toBe("done");
    expect(done.events.at(-1)).toMatchObject({ type: "CampaignEnded" });
  });

  it("brings a contained week-1 result into week 2 as hidden reservoirs", () => {
    let found = 0;
    for (let seed = 1; seed <= 400 && found < 5; seed++) {
      let c = createCampaign({ seed }).state;
      c = playLifeWeek(
        c,
        CAMPAIGN_BOTS.riskyNoDoctor(() => 0),
      );
      c = endWeek(c).state;
      if (c.mode !== "battle") continue;
      c = syncBattle(
        c,
        playBattle(BOTS.engulfAll, c.battle as BattleState, seed).final,
      ).state;
      if (c.result?.kind !== "battle") continue;
      const left = c.result.outcome.reservoirs;
      c = nextCycle(c).state;
      if (left.length === 0) continue;
      found++;
      expect(c.life.reservoirs.map((r) => [r.kind, r.size, r.hidden])).toEqual(
        carryReservoirs(left).kept.map((r) => [r.kind, r.size, true]),
      );
    }
    expect(found).toBeGreaterThan(0);
  });

  it("starts week 2's exposure battle with the carried reservoirs as hidden tokens", () => {
    for (let seed = 1; seed <= 400; seed++) {
      let c = createCampaign({ seed, reservoirs: [MOLD2] }).state;
      c = playLifeWeek(
        c,
        CAMPAIGN_BOTS.riskyNoDoctor(() => 0),
      );
      const due = battleDue(c.life);
      if (due.battleKind !== "full" || due.reasons.includes("reservoir"))
        continue;
      c = check(endWeek(c));
      const tokens = (c.battle as BattleState).pathogens.filter(
        (p) => p.hidden,
      );
      expect(tokens.map((p) => p.kind)).toEqual(["aspergillus"]);
      return;
    }
    throw new Error("no exposure-only battle with a reservoir in 400 seeds");
  });

  it("takes a battle the UI resolved itself", () => {
    let c = createCampaign({ seed: 2, reservoirs: [MOLD2] }).state;
    c = playLifeWeek(
      c,
      CAMPAIGN_BOTS.smarter(() => 0),
    );
    c = check(endWeek(c));
    expect(c.mode).toBe("battle");
    let battle = c.battle as BattleState;
    expect(check(syncBattle(c, battle)).mode).toBe("battle");
    while (!battleStatus(battle).over) battle = resolveTurn(battle, []).state;
    const done = check(syncBattle(c, battle));
    expect(done.mode).toBe("outcome");
    expect(done.battle).toEqual(battle);
  });

  it("is deterministic per seed and strategy", () => {
    for (const name of Object.keys(CAMPAIGN_BOTS)) {
      expect(playCampaign(CAMPAIGN_BOTS[name], 9)).toEqual(
        playCampaign(CAMPAIGN_BOTS[name], 9),
      );
    }
    expect(playCampaign(CAMPAIGN_BOTS.risky, 9)).not.toEqual(
      playCampaign(CAMPAIGN_BOTS.risky, 10),
    );
  });

  it("rolls different dice in week 2 than in week 1", () => {
    const a = createLife({ seed: 5, week: 1 });
    const b = createLife({ seed: 5, week: 2 });
    expect(a.rng).not.toEqual(b.rng);
  });
});

/** Week 1 at home (nothing placed, no doctor): always a skirmish. */
function homeSkirmish(seed: number, opts: Partial<CampaignOptions> = {}) {
  let c = createCampaign({ seed, ...opts }).state;
  c = playLifeWeek(c, { ...CAMPAIGN_BOTS.home(() => 0), doctor: "never" });
  return { before: c, step: endWeek(c) };
}

/** Ends the skirmish with zero orders (germs left loose) or the thoughtful player (cleared). */
function finishSkirmish(c: Campaign, seed: number, clear: boolean): Campaign {
  const battle = c.battle as BattleState;
  if (clear) return check(syncBattle(c, thoughtfulPlay(battle, seed).final));
  while (c.mode === "battle") c = check(battleTurn(c, []));
  return c;
}

describe("skirmishes", () => {
  it("is always due unless a viral visit took the week", () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const bot of ["home", "smarter", "riskyNoDoctor", "mixed"]) {
        const c = playLifeWeek(
          createCampaign({ seed }).state,
          CAMPAIGN_BOTS[bot](() => 0.5),
        );
        const due = battleDue(c.life);
        const viral =
          c.life.doctor?.finding === "viral" && due.reasons.length === 0;
        expect(due.due).toBe(!viral);
        expect(due.battleKind).toBe(
          viral ? null : due.reasons.length > 0 ? "full" : "skirmish",
        );
      }
    }
  });

  it("starts a short, small, leaky battle and says it is a skirmish", () => {
    const S = C.skirmish;
    for (let seed = 1; seed <= 200; seed++) {
      const { step } = homeSkirmish(seed);
      const c = check(step);
      expect(step.events).toEqual([
        {
          type: "BattleStarted",
          battleKind: "skirmish",
          reasons: [],
          hiddenTokens: 0,
        },
      ]);
      const b = c.battle as BattleState;
      expect(c).toMatchObject({ mode: "battle", battleKind: "skirmish" });
      expect(b).toMatchObject({ kind: "skirmish", maxTurns: S.maxTurns });
      // The threats come in two groups: the first on the board, the rest arriving.
      const threats = b.pathogens.length + b.arrivals.length;
      expect(threats).toBeGreaterThanOrEqual(S.threats.min);
      expect(threats).toBeLessThanOrEqual(S.threats.max);
      expect(b.pathogens).toHaveLength(PARAMS.waves.skirmishFirst);
      for (const a of b.arrivals) {
        expect(a).toMatchObject({
          turn: 1 + PARAMS.waves.skirmishDelay,
          kind: S.threats.kind,
          size: S.threats.size,
        });
      }
      for (const p of b.pathogens) {
        expect(p).toMatchObject({
          kind: S.threats.kind,
          size: S.threats.size,
          hidden: false,
        });
        expect(wallOf(p)).toBe("leaky");
      }
    }
  });

  it("is deterministic per seed and week, and varies across seeds", () => {
    expect(homeSkirmish(5).step).toEqual(homeSkirmish(5).step);
    const layouts = new Set(
      Array.from({ length: 30 }, (_, i) =>
        JSON.stringify(
          (homeSkirmish(i + 1).step.state.battle as BattleState).pathogens.map(
            (p) => p.at,
          ),
        ),
      ),
    );
    expect(layouts.size).toBeGreaterThan(5);
  });

  it("pays a small bonus when cleared, and is winnable by the thoughtful player", () => {
    let cleared = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let c = check(homeSkirmish(seed).step);
      c = finishSkirmish(c, seed, true);
      expect(c.result).toMatchObject({
        kind: "battle",
        battleKind: "skirmish",
      });
      if (c.result?.kind !== "battle" || c.result.outcome.grade !== "cleared")
        continue;
      cleared++;
      expect(c.result.outcome.energy).toBe(C.skirmish.energy.cleared);
      const left = c.life.energy;
      expect(carryPreview(c).energy.next).toBe(
        Math.min(
          PARAMS.life.maxEnergy,
          left + C.weekRecovery + C.skirmish.energy.cleared,
        ),
      );
      const next = check(nextCycle(c));
      expect(next.life.aftermath).toBeNull();
    }
    expect(cleared / 200).toBeGreaterThan(0.95);
  });

  it("costs energy and leaves a flavor aftermath, not a symptom, when germs stay loose", () => {
    let loose = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let c = check(homeSkirmish(seed).step);
      c = finishSkirmish(c, seed, false);
      if (c.result?.kind !== "battle" || c.result.outcome.grade === "cleared")
        continue;
      loose++;
      expect(c.result.outcome.energy).toBe(C.skirmish.energy.loose);
      expect(C.skirmish.energy.loose).toBeLessThan(C.skirmish.energy.cleared);
      const carry = carryPreview(c);
      const step = nextCycle(c);
      const next = check(step);
      const aftermath = next.life.aftermath;
      expect(aftermath).toMatchObject({ energy: C.skirmish.aftermathEnergy });
      expect(next.life.energy).toBe(
        Math.max(0, carry.energy.next - C.skirmish.aftermathEnergy) -
          (next.life.symptoms.some((s) => s.kind === "tired")
            ? C.symptoms.tiredEnergy
            : 0),
      );
      expect(step.events).toContainEqual({
        type: "Life",
        event: { type: "SkirmishAftermath", aftermath },
      });
      // Flavor only: no symptom, no doctor, no reservoir.
      if (viralFeverDay(seed, 2) === null) {
        expect(next.life.symptoms).toEqual([]);
        expect(next.life.hand).not.toContain("doctor");
      }
      expect(next.life.reservoirs).toEqual([]);
      expect(carry.kept).toEqual([]);
      // It does not snowball: the next week's aftermath depends only on that week's skirmish.
      let d = playLifeWeek(next, {
        ...CAMPAIGN_BOTS.home(() => 0),
        doctor: "never",
      });
      d = check(endWeek(d));
      expect(d.battleKind).toBe("skirmish");
    }
    expect(loose).toBeGreaterThan(50);
  });

  it("never touches or creates a carried reservoir", () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { before, step } = homeSkirmish(seed, { reservoirs: [STAPH1] });
      if (step.state.mode !== "battle" || step.state.battleKind !== "skirmish")
        continue;
      checked++;
      let c = check(step);
      expect(
        (c.battle as BattleState).pathogens.every((p) => p.kind === "strep"),
      ).toBe(true);
      c = finishSkirmish(c, seed, seed % 2 === 0);
      const kept = carryPreview(c).kept;
      expect(kept).toEqual(carryReservoirs(before.life.reservoirs).kept);
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("survives JSON and validates at every step, aftermath included", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let c = check(homeSkirmish(seed).step);
      c = finishSkirmish(c, seed, false);
      c = check(nextCycle(c));
      expect(JSON.parse(JSON.stringify(c))).toEqual(c);
      expect(validateCampaign(c)).toEqual([]);
    }
    const c = check(homeSkirmish(1).step);
    expect(validateCampaign({ ...c, battleKind: "full" })).toContain(
      "battleKind and battle disagree",
    );
    expect(
      validateCampaign({
        ...c,
        life: { ...c.life, aftermath: { kind: "wornOut", energy: 9 } },
      }),
    ).toContain("life: invalid skirmish aftermath");
  });
});

describe("session log", () => {
  function session(): SessionLog {
    let log = createSessionLog(4, C.cycles);
    let t = 0;
    let step = createCampaign({ seed: 4 });
    log = logStep(log, step, t);
    step = lifeAction(step.state, (l) => placeCard(l, 0, 1, "sleepover", true));
    log = logStep(log, step, (t += 1200));
    while (!weekOver(step.state.life)) {
      step = lifeAction(step.state, advanceDay);
      log = logStep(log, step, (t += 800));
    }
    step = endWeek(step.state);
    log = logStep(log, step, (t += 50));
    if (step.state.mode === "battle") {
      log = appendEntry(log, {
        t: t + 9000,
        cycle: 1,
        type: "turn",
        turn: 1,
        orders: [],
        support: null,
        planningMs: 8700,
        playbackMs: 2500,
        skipped: false,
        replays: 0,
        speed: 1,
      });
    }
    return log;
  }

  it("records card choices, doses and the week's result in order", () => {
    const log = session();
    const kinds = log.entries.map((e) => e.type);
    expect(kinds[0]).toBe("session");
    expect(log.entries).toContainEqual(
      expect.objectContaining({
        type: "card",
        card: "sleepover",
        packPills: true,
      }),
    );
    expect(kinds.filter((k) => k === "meds")).toHaveLength(PARAMS.life.days);
    expect(kinds).toContain("exposure");
    expect(kinds.includes("battleStarted") || kinds.includes("outcome")).toBe(
      true,
    );
  });

  it("round-trips through the JSON export and carries no identifiers", () => {
    const log = session();
    const text = exportSessionLog(log);
    expect(parseSessionLog(text)).toEqual(log);
    expect(text).not.toMatch(/"(name|email|date|user|id)"/i);
    expect(() => parseSessionLog('{"schema":2,"entries":[]}')).toThrow();
    expect(() =>
      parseSessionLog('{"schema":1,"entries":[{"type":"x"}]}'),
    ).toThrow();
  });

  it("refuses an entry that goes back in time", () => {
    const log = createSessionLog(1, 2, 100);
    expect(() =>
      appendEntry(log, { t: 50, type: "ui", action: "help", detail: "" }),
    ).toThrow(/before/);
  });
});
