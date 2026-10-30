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
  setPackPills,
  skipMeds,
  takeMeds,
  todayDose,
  unplaceCard,
  weekOver,
} from "./calendar";
import { CARD_IDS, cardDef, HAND, versionsOf } from "./cards";
import { battleDue, battleSeed, loadoutFromLife } from "./loadout";
import { medLevelOf } from "./meds";
import { cardPreview, exposurePreview } from "./preview";
import type { CardId, Dose, LifeEvent, LifeState } from "./types";

const L = PARAMS.life;

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
  it("has a smarter version for exactly two hand cards", () => {
    expect(HAND.filter((c) => versionsOf(c).length === 2)).toEqual([
      "yard",
      "lake",
    ]);
  });

  it("pays more for the risky version, but keeps most of it in the smarter one", () => {
    for (const base of HAND) {
      const [risky, smarter] = versionsOf(base).map(cardDef);
      if (!smarter) continue;
      expect(risky.points).toBeGreaterThan(smarter.points);
      expect(smarter.points / risky.points).toBeGreaterThanOrEqual(0.75);
      expect(smarter.exposure.chance).toBeLessThan(risky.exposure.chance);
      expect(smarter.exposure.size * smarter.exposure.count).toBeLessThan(
        risky.exposure.size * risky.exposure.count,
      );
      expect(smarter.base).toBe(base);
    }
  });

  it("uses strep for bacteria and aspergillus for mold, with valid odds and tiles", () => {
    expect(cardDef("yard").exposure.kind).toBe("aspergillus");
    expect(cardDef("lake").exposure.kind).toBe("strep");
    for (const id of CARD_IDS) {
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
    for (const e of end.exposures)
      expect(e).toMatchObject({
        kind: "strep",
        size: L.cards.lake.size,
        card: "lake",
      });
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
  it("is a quiet week when nothing lands and no reservoir is carried", () => {
    const home = finish(createLife({ seed: 1 }));
    expect(battleDue(home)).toEqual({
      due: false,
      reasons: [],
      quietWeek: true,
    });
    expect(loadoutFromLife(home)).toMatchObject({
      medLevel: 1,
      exposures: [],
      reservoirs: [],
      doctorVisit: false,
      energy: home.energy,
      load: 0,
    });
  });

  it("is not a quiet week before the dice are rolled", () => {
    expect(battleDue(createLife({ seed: 1 })).quietWeek).toBe(false);
  });

  it("calls a battle for a carried reservoir even in a quiet week", () => {
    const reservoirs = [
      { kind: "aspergillus" as const, size: 1, hidden: true },
    ];
    const life = finish(createLife({ seed: 1, reservoirs }));
    expect(battleDue(life)).toEqual({
      due: true,
      reasons: ["reservoir"],
      quietWeek: false,
    });
    expect(loadoutFromLife(life).reservoirs).toEqual(reservoirs);
  });

  it("carries every landed exposure into a valid battle on distinct tiles", () => {
    let battles = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const life = playWeek(LIFE_BOTS.risky, seed);
      const due = battleDue(life);
      expect(due.due).toBe(life.exposures.length > 0);
      if (!due.due) continue;
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
