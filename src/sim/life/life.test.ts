import { describe, expect, it } from "vitest";
import { chargesFor, battleFromLoadout } from "../battle/setup";
import { PARAMS } from "../params";
import { validateBattle } from "../validate";
import { LIFE_BOTS, playWeek } from "./bots";
import {
  advanceDay,
  createLife,
  energyPlan,
  medForecast,
  placeCard,
  placementProblems,
  setDose,
  setPackPills,
  slipRoll,
  skipMeds,
  takeMeds,
  todayDose,
  unplaceCard,
  weekOver,
} from "./calendar";
import { CARD_IDS, cardDef, handFor, versionsOf } from "./cards";
import { battleDue, battleSeed, loadoutFromLife } from "./loadout";
import { medLevelOf } from "./meds";
import { cardPreview, exposurePreview } from "./preview";
import { plannedChoices, weekChoices } from "../score";
import { PARAMS as P } from "../params";
import type { CardId, Dose, LifeEvent, LifeState } from "./types";

const L = PARAMS.life;
const HAND = handFor(1);

/** Applies steps in order, keeping every event. */
function run(
  life: LifeState,
  ...steps: ((s: LifeState) => {
    state: LifeState;
    events: readonly LifeEvent[];
  })[]
): { state: LifeState; events: LifeEvent[] } {
  const events: LifeEvent[] = [];
  for (const step of steps) {
    const r = step(life);
    life = r.state;
    events.push(...r.events);
  }
  return { state: life, events };
}

const finish = (life: LifeState) => {
  while (!weekOver(life)) life = advanceDay(life).state;
  return life;
};

const place =
  (day: number, slot: number, card: CardId, pack = false) =>
  (s: LifeState) =>
    placeCard(s, day, slot, card, pack);

describe("cards", () => {
  it("deals five cards, three of them with a smarter version", () => {
    expect(HAND).toEqual(["yard", "lake", "band", "sleepover", "game"]);
    expect(HAND.filter((c) => versionsOf(c).length === 2)).toEqual([
      "yard",
      "lake",
      "game",
    ]);
  });

  it("pays more for the risky version, but keeps most of it in the smarter one", () => {
    for (const base of HAND) {
      const [risky, smarter] = versionsOf(base).map(cardDef);
      if (!smarter) continue;
      expect(risky.points).toBeGreaterThan(smarter.points);
      // Home by 11 is smarter by routine (no late night), not by exposure.
      if (base !== "game") {
        expect(smarter.points / risky.points).toBeGreaterThanOrEqual(0.75);
        expect(smarter.exposure.chance).toBeLessThan(risky.exposure.chance);
        expect(smarter.exposure.size * smarter.exposure.count).toBeLessThan(
          risky.exposure.size * risky.exposure.count,
        );
      }
      expect(smarter.base).toBe(base);
    }
  });

  it("brings mold from the yard, strep and staph from the lake, with valid odds and tiles", () => {
    expect(cardDef("yard").exposure.kinds).toEqual(["aspergillus"]);
    expect(cardDef("lake").exposure.kinds).toEqual(["strep", "staph"]);
    expect(cardDef("beach").exposure.kinds).toEqual(["strep"]);
    expect(cardPreview(createLife({ seed: 1 }), "lake").kinds).toEqual([
      "strep",
      "staph",
    ]);
    for (const id of CARD_IDS.filter((c) => c !== "doctor")) {
      const d = cardDef(id);
      expect(d.exposure.chance).toBeGreaterThan(0);
      expect(d.exposure.chance).toBeLessThan(1);
      expect(d.exposure.size).toBeLessThanOrEqual(PARAMS.maxPathogenSize);
      expect(d.exposure.at.length).toBeGreaterThan(0);
      expect(d.label && d.people && d.blurb).toBeTruthy();
    }
  });

  it("gives honest odds: no card lands more often than not", () => {
    for (const id of CARD_IDS)
      expect(cardDef(id).exposure.chance).toBeLessThan(0.5);
  });
});

describe("calendar rules", () => {
  const life = createLife({ seed: 1 });

  it("starts a week at day 0 with the hand, empty slots and full meds", () => {
    expect(life.day).toBe(0);
    expect(life.hand).toEqual(HAND);
    expect(life.plan).toHaveLength(L.days);
    expect(life.plan.every((r) => r.length === L.slotsPerDay)).toBe(true);
    expect(life.medLevel).toBe(1);
    expect(life.energy).toBe(L.startEnergy);
    expect(life.goal).toEqual({ points: 0, target: L.goalTarget });
  });

  it("plays each hand card once, in either version", () => {
    const s = placeCard(life, 0, 0, "yard").state;
    expect(placementProblems(s, 1, 0, "yardIndoor")).toEqual([
      "yard is already on day 1",
    ]);
    // Swapping versions in the same slot is a replace.
    const swapped = placeCard(s, 0, 0, "yardIndoor");
    expect(swapped.state.plan[0][0]?.card).toBe("yardIndoor");
    expect(swapped.events.map((e) => e.type)).toEqual([
      "CardRemoved",
      "CardPlaced",
    ]);
  });

  it("keeps the sleepover to an evening before another day", () => {
    expect(placementProblems(life, 0, 0, "sleepover")).toHaveLength(1);
    expect(placementProblems(life, L.days - 1, 1, "sleepover")).toHaveLength(1);
    expect(placementProblems(life, 1, 1, "sleepover")).toEqual([]);
  });

  it("rejects a plan whose energy would go below zero at any point", () => {
    const s = run(life, place(0, 0, "yard"), place(0, 1, "lake")).state;
    expect(energyPlan(s)[0]).toEqual([3, 1]);
    // Band on day 2 spends the last point; a packed sleepover that evening would need 2 more.
    const t = placeCard(s, 1, 0, "band").state;
    expect(energyPlan(t)[1]).toEqual([0, 1]);
    expect(placementProblems(t, 1, 1, "sleepover", true)).toEqual([
      "not enough energy",
    ]);
    expect(() => placeCard(t, 1, 1, "sleepover", true)).toThrow(/energy/);
  });

  it("rejects bad slots and days that are over", () => {
    expect(placementProblems(life, 3, 0, "band")).toEqual(["no day 3"]);
    expect(placementProblems(life, 0, 2, "band")).toEqual(["no slot 2"]);
    const later = advanceDay(life).state;
    expect(placementProblems(later, 0, 0, "band")).toEqual([
      "that day is over",
    ]);
    expect(() => unplaceCard(later, 0, 0)).toThrow();
    expect(() => advanceDay(finish(life))).toThrow();
  });

  it("scores cards when their day ends, and rest scores nothing but refunds energy", () => {
    const s = advanceDay(placeCard(life, 0, 0, "band").state);
    expect(s.state.goal.points).toBe(cardDef("band").points);
    expect(s.state.energy).toBe(
      L.startEnergy - cardDef("band").energy + L.restEnergy,
    );
    expect(s.events.map((e) => e.type)).toEqual([
      "MedsTaken",
      "CardPlayed",
      "GoalPoints",
      "ExposureRolled",
      "EnergyChanged",
      "Rested",
      "EnergyChanged",
      "DayStarted",
    ]);
    const home = finish(life);
    expect(home.goal.points).toBe(0);
    expect(home.energy).toBe(L.maxEnergy);
  });

  it("unplaces a card and frees the hand card", () => {
    const s = run(life, place(0, 0, "lake"), (x) => unplaceCard(x, 0, 0));
    expect(s.state.plan[0][0]).toBeNull();
    expect(placementProblems(s.state, 2, 0, "beach")).toEqual([]);
  });
});

describe("meds", () => {
  const dose = (taken: boolean): Dose => ({
    week: 1,
    day: 0,
    taken,
    cause: taken ? "tapped" : "skipped",
  });

  it("is the share of the last three doses taken", () => {
    expect(medLevelOf([])).toBe(1);
    expect(medLevelOf([true, true, true].map(dose))).toBe(1);
    expect(medLevelOf([false, true, true, true].map(dose))).toBe(1);
    expect(medLevelOf([true, false, true].map(dose))).toBeCloseTo(2 / 3);
    expect(medLevelOf([false, true, false].map(dose))).toBeCloseTo(1 / 3);
  });

  it("drops one missed dose out of the top charge tier, two out of every tier", () => {
    const one = medLevelOf([true, false, true].map(dose));
    const two = medLevelOf([false, true, false].map(dose));
    expect(chargesFor(1)).toMatchObject({ antibacterial: 1, antifungal: 2 });
    expect(chargesFor(one)).toMatchObject({ antibacterial: 0, antifungal: 1 });
    expect(chargesFor(two)).toMatchObject({ antibacterial: 0, antifungal: 0 });
  });

  it("takes the dose by default when the day ends untapped", () => {
    const s = advanceDay(createLife({ seed: 2 })).state;
    expect(s.doses.at(-1)).toMatchObject({
      day: 0,
      taken: true,
      cause: "default",
    });
    expect(s.medLevel).toBe(1);
  });

  it("dims the aura on a skip, keeps it dim while the miss is in the window, then recovers", () => {
    let s = createLife({ seed: 2 });
    const r = skipMeds(s);
    expect(r.events).toContainEqual({
      type: "MedLevelChanged",
      from: 1,
      to: 2 / 3,
    });
    s = advanceDay(r.state).state;
    expect(s.streak).toBe(0);
    const levels: number[] = [s.medLevel];
    s = advanceDay(s).state;
    levels.push(s.medLevel);
    s = finish(s);
    levels.push(s.medLevel);
    expect(levels).toEqual([2 / 3, 2 / 3, 2 / 3]);
    expect(s.streak).toBe(2);
    // Next week's first dose pushes the miss out of the window.
    const next = advanceDay(
      createLife({ seed: 2, week: 2, doses: s.doses }),
    ).state;
    expect(next.medLevel).toBe(1);
  });

  it("lets a skip be undone by tapping take the same day", () => {
    const s = run(createLife({ seed: 2 }), skipMeds, takeMeds).state;
    expect(s.medLevel).toBe(1);
    expect(todayDose(s)?.cause).toBe("tapped");
    expect(s.doses.filter((d) => d.week === 1)).toHaveLength(1);
  });
});

describe("setDose, the per-day toggle", () => {
  const forecast = (s: LifeState) => medForecast(s).map((f) => f.taken);

  it("toggles any unplayed day both ways, as often as wanted", () => {
    let s = createLife({ seed: 2 });
    s = setDose(s, 2, false).state;
    expect(forecast(s)).toEqual([true, true, false]);
    expect(exposurePreview(s).medLevel).toBeCloseTo(2 / 3);
    s = setDose(s, 2, true).state;
    expect(forecast(s)).toEqual([true, true, true]);
    expect(exposurePreview(s).medLevel).toBe(1);
    s = setDose(setDose(s, 1, false).state, 2, false).state;
    expect(exposurePreview(s).medLevel).toBeCloseTo(1 / 3);
    s = setDose(s, 1, true).state;
    expect(exposurePreview(s).medLevel).toBeCloseTo(2 / 3);
    // Future days wait in the plan; the dose history and today's level are untouched.
    expect(s.doses.filter((d) => d.week === 1)).toHaveLength(0);
    expect(s.medLevel).toBe(1);
  });

  it("changes today's dose at once and back again", () => {
    let s = setDose(createLife({ seed: 2 }), 0, false).state;
    expect(s.medLevel).toBeCloseTo(2 / 3);
    s = setDose(s, 0, true).state;
    expect(s.medLevel).toBe(1);
    expect(s.doses.filter((d) => d.week === 1)).toHaveLength(1);
  });

  it("plays a planned skip on its day and an untouched day as taken", () => {
    let s = setDose(createLife({ seed: 2 }), 1, false).state;
    const r = advanceDay(s);
    expect(r.events).toContainEqual({
      type: "MedsTaken",
      day: 0,
      cause: "default",
      streak: 4,
    });
    expect(r.events).toContainEqual({
      type: "MedsSkipped",
      day: 1,
      cause: "skipped",
    });
    s = r.state;
    expect(todayDose(s)).toMatchObject({ day: 1, taken: false });
    expect(s.medLevel).toBeCloseTo(2 / 3);
    s = advanceDay(s).state;
    expect(s.doses.at(-1)).toMatchObject({ day: 1, taken: false });
    s = advanceDay(s).state;
    expect(s.doses.filter((d) => d.week === 1).map((d) => d.cause)).toEqual([
      "default",
      "skipped",
      "default",
    ]);
  });

  it("refuses played days, other weeks and a finished week", () => {
    const s = advanceDay(createLife({ seed: 2 })).state;
    expect(() => setDose(s, 0, false)).toThrow(/played/);
    expect(() => setDose(s, 3, false)).toThrow(/no such day/);
    expect(() => setDose(finish(s), 1, false)).toThrow(/over/);
  });

  it("locks the friction day, planned or already lost", () => {
    let s = placeCard(createLife({ seed: 4 }), 0, 1, "sleepover", false).state;
    expect(() => setDose(s, 1, true)).toThrow(/home/);
    expect(forecast(s)).toEqual([true, false, true]);
    s = advanceDay(s).state;
    expect(() => setDose(s, 1, true)).toThrow(/home/);
    expect(() => takeMeds(s)).toThrow(/home/);
    setDose(s, 2, false);
  });

  it("friction beats a choice made before the sleepover was planned", () => {
    let s = setDose(createLife({ seed: 4 }), 1, true).state;
    s = placeCard(s, 0, 1, "sleepover", false).state;
    expect(forecast(s)).toEqual([true, false, true]);
    s = advanceDay(s).state;
    expect(todayDose(s)).toMatchObject({ taken: false, cause: "friction" });
  });

  it("keeps the score meds part right after toggles", () => {
    const per = P.score.perDose;
    let s = createLife({ seed: 2 });
    expect(plannedChoices(s).meds).toBe(3 * per);
    s = setDose(s, 2, false).state;
    expect(plannedChoices(s).meds).toBe(2 * per);
    s = setDose(s, 2, true).state;
    expect(plannedChoices(s).meds).toBe(3 * per);
    s = setDose(s, 0, false).state;
    expect(weekChoices(s).meds).toBe(0);
    expect(plannedChoices(s).meds).toBe(2 * per);
    s = setDose(s, 0, true).state;
    expect(weekChoices(s).meds).toBe(per);
    s = finish(setDose(s, 1, false).state);
    expect(weekChoices(s).meds).toBe(2 * per);
  });
});

describe("the sleepover friction event", () => {
  const withSleepover = (pack: boolean) =>
    placeCard(createLife({ seed: 4 }), 0, 1, "sleepover", pack).state;

  it("is visible in the forecast before the day is played", () => {
    expect(medForecast(withSleepover(false)).map((d) => d.cause)).toEqual([
      "default",
      "friction",
      "default",
    ]);
    expect(exposurePreview(withSleepover(false))).toMatchObject({
      frictionDays: [1],
      medLevel: 2 / 3,
      charges: { antibacterial: 0, antifungal: 1 },
    });
    expect(exposurePreview(withSleepover(true)).frictionDays).toEqual([]);
    expect(cardPreview(withSleepover(false), "sleepover").friction).toEqual({
      packPillsEnergy: L.packPillsEnergy,
    });
  });

  it("misses the next morning's dose unless the pills were packed", () => {
    const r = advanceDay(withSleepover(false));
    expect(r.events).toContainEqual({
      type: "FrictionEvent",
      day: 1,
      card: "sleepover",
    });
    expect(r.events).toContainEqual({
      type: "MedsSkipped",
      day: 1,
      cause: "friction",
    });
    expect(r.state.flags.frictionFired).toBe(true);
    expect(r.state.medLevel).toBeCloseTo(2 / 3);
    expect(() => takeMeds(r.state)).toThrow(/home/);
    expect(finish(r.state).medLevel).toBeCloseTo(2 / 3);

    const packed = advanceDay(withSleepover(true));
    expect(packed.events.some((e) => e.type === "FrictionEvent")).toBe(false);
    expect(finish(packed.state).medLevel).toBe(1);
  });

  it("charges energy for packing, so it competes with a card", () => {
    const s = withSleepover(false);
    const packed = setPackPills(s, 0, 1, true).state;
    expect(energyPlan(packed)[0][1]).toBe(
      energyPlan(s)[0][1] - L.packPillsEnergy,
    );
    expect(setPackPills(packed, 0, 1, false).state.plan[0][1]?.packPills).toBe(
      false,
    );
    expect(() => setPackPills(s, 0, 0, true)).toThrow();
  });
});

describe("exposure", () => {
  it("previews each card's odds, kind, size and points", () => {
    const life = createLife({ seed: 1 });
    expect(cardPreview(life, "lake")).toMatchObject({
      kind: "strep",
      chance: L.cards.lake.chance,
      size: L.cards.lake.size,
      count: L.cards.lake.count,
      expectedPathogens: L.cards.lake.chance * L.cards.lake.count,
      points: L.cards.lake.points,
      otherVersion: "beach",
      smarter: false,
    });
    expect(cardPreview(life, "beach")).toMatchObject({
      otherVersion: "lake",
      smarter: true,
    });
  });

  it("previews the week: odds of any exposure, planned points and expected pathogens", () => {
    const s = run(
      createLife({ seed: 1 }),
      place(0, 0, "yard"),
      place(1, 0, "beach"),
    ).state;
    const p = exposurePreview(s);
    const y = L.cards.yard.chance;
    const b = L.cards.beach.chance;
    expect(p.chanceAnyExposure).toBeCloseTo(1 - (1 - y) * (1 - b));
    expect(p.chanceBattle).toBeCloseTo(p.chanceAnyExposure);
    expect(p.points.planned).toBe(L.cards.yard.points + L.cards.beach.points);
    expect(p.expectedPathogens.aspergillus).toBeCloseTo(y);
    expect(p.pending.map((x) => x.preview.card)).toEqual(["yard", "beach"]);
    expect(exposurePreview(createLife({ seed: 1 })).chanceBattle).toBe(0);
  });

  it("lands as often as the preview says", () => {
    const n = 4000;
    const landed: Record<string, number> = { yard: 0, lake: 0, beach: 0 };
    let anyLanded = 0;
    let previewed = 0;
    for (let seed = 1; seed <= n; seed++) {
      const s = run(
        createLife({ seed }),
        place(0, 0, "yard"),
        place(1, 0, "lake"),
        place(2, 1, "band"),
      ).state;
      previewed += exposurePreview(s).chanceAnyExposure / n;
      const end = finish(s);
      for (const r of end.rolls)
        if (r.landed && r.card in landed) landed[r.card]++;
      if (end.exposures.length > 0) anyLanded++;
    }
    expect(landed.yard / n).toBeCloseTo(L.cards.yard.chance, 1);
    expect(landed.lake / n).toBeCloseTo(L.cards.lake.chance, 1);
    expect(anyLanded / n).toBeCloseTo(previewed, 1);
  });

  it("rolls once per slot whatever is placed, so the same seed compares choices fairly", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const risky = finish(placeCard(createLife({ seed }), 1, 0, "lake").state);
      const smart = finish(
        placeCard(createLife({ seed }), 1, 0, "beach").state,
      );
      expect(smart.rolls[0].roll).toBe(risky.rolls[0].roll);
      // A lower chance on the same roll can only land when the risky one did.
      if (smart.exposures.length > 0)
        expect(risky.exposures.length).toBeGreaterThan(0);
      expect(smart.rng).toEqual(risky.rng);
    }
  });

  it("brings `count` pathogens of the card's kind and size when it lands", () => {
    const end = finish(placeCard(createLife({ seed: 1 }), 0, 0, "lake").state);
    const roll = end.rolls[0];
    expect(end.exposures).toHaveLength(roll.landed ? L.cards.lake.count : 0);
    // Dice are keyed by card now, so seed 1's lake lands: both of its kinds appear.
    expect(end.exposures.map((e) => e.kind)).toEqual(
      roll.landed ? ["strep", "staph"] : [],
    );
    for (const e of end.exposures)
      expect(e).toMatchObject({ size: L.cards.lake.size, card: "lake" });
  });

  it("rolls each card's dice from seed, week and card, wherever it sits in the calendar", () => {
    const slots: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ];
    for (const seed of [1, 2, 3, 7, 11]) {
      const rollsOf = (day: number, slot: number, card: CardId) => {
        const end = finish(
          placeCard(createLife({ seed }), day, slot, card).state,
        );
        return end.rolls.filter((r) => r.card === card).map((r) => r.roll);
      };
      for (const card of ["yard", "lake", "beach", "band"] as CardId[]) {
        if (cardDef(card).overnight) continue;
        const rolls = slots
          .filter(
            ([d, sl]) =>
              placementProblems(createLife({ seed }), d, sl, card, false)
                .length === 0,
          )
          .map(([d, sl]) => rollsOf(d, sl, card));
        expect(rolls.length).toBeGreaterThan(1);
        for (const r of rolls) expect(r).toEqual(rolls[0]);
      }
      // The same card across weeks differs, and the version does not matter.
      const w2 = finish(
        placeCard(createLife({ seed, week: 2 }), 0, 0, "lake").state,
      );
      expect(w2.rolls[0].roll).not.toBe(rollsOf(0, 0, "lake")[0]);
    }
  });
});

describe("determinism and serialization", () => {
  it("plays the same week the same way for the same seed and choices", () => {
    for (const bot of Object.values(LIFE_BOTS)) {
      expect(playWeek(bot, 17)).toEqual(playWeek(bot, 17));
    }
  });

  it("survives a JSON round trip mid-week", () => {
    const s = run(
      createLife({ seed: 9 }),
      place(0, 0, "yard"),
      place(0, 1, "sleepover"),
      place(1, 1, "lake"),
      advanceDay,
    ).state;
    const copy = JSON.parse(JSON.stringify(s)) as LifeState;
    expect(copy).toEqual(s);
    expect(finish(copy)).toEqual(finish(s));
  });

  it("gives different loadouts for different choices on the same seed", () => {
    const a = loadoutFromLife(playWeek(LIFE_BOTS.risky, 3));
    const b = loadoutFromLife(playWeek(LIFE_BOTS.riskyNoPack, 3));
    expect(a.medLevel).not.toBe(b.medLevel);
    expect(a.seed).toBe(b.seed);
  });
});

describe("loadoutFromLife and battleDue", () => {
  it("skirmishes when nothing lands and no reservoir is carried", () => {
    const home = finish(createLife({ seed: 1 }));
    expect(battleDue(home)).toEqual({
      due: true,
      battleKind: "skirmish",
      reasons: [],
    });
    const loadout = loadoutFromLife(home);
    expect(loadout).toMatchObject({
      kind: "skirmish",
      medLevel: 1,
      reservoirs: [],
      doctorVisit: false,
      energy: home.energy,
      load: 0,
    });
    expect(loadout.exposures.length).toBeGreaterThan(0);
  });

  it("reads as a skirmish before the dice are rolled, with the full loadout mid-week", () => {
    const life = createLife({ seed: 1 });
    expect(battleDue(life)).toMatchObject({
      due: true,
      battleKind: "skirmish",
    });
    expect(loadoutFromLife(life)).toMatchObject({
      kind: "full",
      exposures: [],
    });
  });

  it("calls a battle for a flared reservoir, which starts visible", () => {
    const reservoirs = [
      { kind: "aspergillus" as const, size: 2, hidden: true },
    ];
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const life = finish(createLife({ seed, reservoirs }));
      const flared = life.reservoirs[0].flared;
      expect(battleDue(life)).toEqual({
        due: true,
        battleKind: flared ? "full" : "skirmish",
        reasons: flared ? ["reservoir"] : [],
      });
      // A skirmish leaves the carried reservoir off its board.
      expect(loadoutFromLife(life).reservoirs).toEqual(
        flared ? [{ kind: "aspergillus", size: 3, hidden: false }] : [],
      );
      checked += flared ? 1 : 0;
    }
    expect(checked).toBeGreaterThan(0);
    expect(checked).toBeLessThan(40);
  });

  it("carries every landed exposure into a valid battle on distinct tiles", () => {
    let battles = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const life = playWeek(LIFE_BOTS.risky, seed);
      const due = battleDue(life);
      expect(due.battleKind).toBe(
        life.exposures.length > 0 ? "full" : "skirmish",
      );
      if (due.battleKind !== "full") continue;
      battles++;
      const loadout = loadoutFromLife(life);
      expect(loadout.seed).toBe(battleSeed(life));
      expect(loadout.exposures.map((e) => [e.kind, e.size])).toEqual(
        life.exposures.map((e) => [e.kind, e.size]),
      );
      const keys = loadout.exposures.map((e) => `${e.at?.x},${e.at?.y}`);
      expect(new Set(keys).size).toBe(keys.length);
      const battle = battleFromLoadout(loadout);
      expect(validateBattle(battle)).toEqual([]);
      expect(battle.pathogens).toHaveLength(life.exposures.length);
      expect(battle.meds.level).toBe(life.medLevel);
    }
    expect(battles).toBeGreaterThan(100);
  });

  it("puts the mold from the yard where the card says", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const life = finish(placeCard(createLife({ seed }), 0, 0, "yard").state);
      if (life.exposures.length === 0) continue;
      expect(loadoutFromLife(life).exposures).toEqual([
        {
          kind: "aspergillus",
          size: L.cards.yard.size,
          at: L.cards.yard.at[0],
        },
      ]);
      return;
    }
    throw new Error("no yard exposure landed in 50 seeds");
  });
});

describe("game night at Alex's", () => {
  const G = P.life.meds.slip.lateNight;
  const withGame = (seed: number, card: CardId, day = 1, slot = 1) =>
    placeCard(createLife({ seed }), day, slot, card).state;
  const lastDose = (l: LifeState, day: number) =>
    l.doses.find((d) => d.week === l.week && d.day === day)!;

  it("deals five cards to both weeks, game night evening only", () => {
    expect(handFor(1)).toHaveLength(5);
    expect(handFor(2)).toEqual(handFor(1));
    const life = createLife({ seed: 1 });
    expect(life.hand).toContain("game");
    for (const card of ["game", "gameEarly"] as const) {
      const p = placementProblems(life, 1, 0, card);
      expect(p).toEqual(["game night is only in the evening"]);
      expect(placementProblems(life, 1, 1, card)).toEqual([]);
      expect(placementProblems(life, 2, 1, card)).toEqual([]);
      expect(() => placeCard(life, 0, 0, card)).toThrow(/evening/);
    }
  });

  it("pairs game night with its home-by-11 version", () => {
    expect(versionsOf("game")).toEqual(["game", "gameEarly"]);
    expect(cardDef("game")).toMatchObject({ points: 3, energy: 1 });
    expect(cardDef("game").exposure.chance).toBe(0.05);
    expect(cardDef("game").lateNight).toBe(true);
    expect(cardDef("gameEarly")).toMatchObject({ points: 2, energy: 1 });
    expect(cardDef("gameEarly").lateNight).toBeUndefined();
    expect(cardDef("gameEarly").base).toBe("game");
  });

  it("puts the dose risk on the card preview", () => {
    const life = createLife({ seed: 1 });
    expect(cardPreview(life, "game").doseRisk).toEqual({
      chance: 0.5,
      text: "late night: 50% the pills slip",
    });
    expect(cardPreview(life, "gameEarly").doseRisk).toBeNull();
    expect(cardPreview(life, "band").doseRisk).toBeNull();
  });

  it("forecasts the slip before the plan is played", () => {
    const life = withGame(1, "game");
    const f = medForecast(life);
    expect(f.map((x) => x.chance)).toEqual([null, G, null]);
    expect(f[1]).toMatchObject({ taken: true, cause: "default" });
    expect(exposurePreview(life).slipDays).toEqual([{ day: 1, chance: G }]);
    expect(
      medForecast(withGame(1, "gameEarly")).every((x) => x.chance === null),
    ).toBe(true);
  });

  it("rolls the slip once per seed, week and day: slipped in about half of seeds", () => {
    let slipped = 0;
    const N = 2000;
    for (let seed = 1; seed <= N; seed++) {
      expect(slipRoll(seed, 1, 1)).toBe(slipRoll(seed, 1, 1));
      const end = finish(withGame(seed, "game"));
      const miss = lastDose(end, 1);
      if (!miss.taken) {
        slipped++;
        expect(miss.cause).toBe("slipped");
      } else expect(miss.cause).toBe("default");
      expect(slipRoll(seed, 1, 1) < G).toBe(!miss.taken);
    }
    expect(slipped / N).toBeGreaterThan(0.46);
    expect(slipped / N).toBeLessThan(0.54);
  });

  it("slips only on a late-night evening, and never for home by 11", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const early = finish(withGame(seed, "gameEarly"));
      expect(early.doses.filter((d) => d.cause === "slipped")).toEqual([]);
      const none = finish(createLife({ seed }));
      expect(none.doses.filter((d) => d.cause === "slipped")).toEqual([]);
    }
  });

  it("moving the card to another day changes which day, never the fairness", () => {
    let both = 0;
    for (let seed = 1; seed <= 400; seed++) {
      for (const day of [0, 1, 2]) {
        const end = finish(withGame(seed, "game", day));
        const slipped = end.doses.filter((d) => d.cause === "slipped");
        expect(slipped.length).toBe(slipRoll(seed, 1, day) < G ? 1 : 0);
        if (slipped.length) expect(slipped[0].day).toBe(day);
      }
      both += slipRoll(seed, 1, 0) < G === slipRoll(seed, 1, 2) < G ? 1 : 0;
    }
    // Different days draw different rolls.
    expect(both).toBeLessThan(400);
  });

  it("is deterministic: the same seed slips the same way twice", () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(finish(withGame(seed, "game")).doses).toEqual(
        finish(withGame(seed, "game")).doses,
      );
    }
  });

  it("treats a slip like any miss: the med level drops and the event is no-blame", () => {
    let seed = 1;
    while (slipRoll(seed, 1, 1) >= G) seed++;
    let life = withGame(seed, "game");
    life = advanceDay(life).state;
    const r = advanceDay(life);
    const ev = r.events.find((e) => e.type === "MedsSkipped");
    expect(ev).toMatchObject({ cause: "slipped", day: 1 });
    expect(r.state.medLevel).toBeCloseTo(2 / 3, 5);
    expect(r.state.streak).toBe(0);
    expect(r.events.some((e) => e.type === "MedLevelChanged")).toBe(true);
  });

  it("leaves an unpacked sleepover's friction alone", () => {
    let l = placeCard(createLife({ seed: 3 }), 0, 1, "sleepover", false).state;
    l = placeCard(l, 1, 1, "game").state;
    const f = medForecast(l);
    expect(f[1]).toMatchObject({
      taken: false,
      cause: "friction",
      chance: null,
    });
  });
});
