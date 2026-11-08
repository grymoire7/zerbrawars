import { battleFromLoadout } from "./battle/setup";
import { skirmishExposures, skirmishWaves, type Loadout } from "./life/loadout";
import { PARAMS } from "./params";
import { rngFromSeed } from "./rng";
import type { BattleState } from "./types";

/**
 * First board, as a loadout: full meds, no reservoirs. Swarms arrive along the near edge. p1
 * (leaky) is one move-and-engulf from s1, an early easy kill. The sealed mold p2 starts at spore
 * size, so turn 1 can already telegraph a spore and s3 must choose: engulf it now (cancels the
 * spore, loads and slows s3, and starts the carried kill rolls), spend the antifungal charge on
 * it, or kill p4, the strep next to it, and deal with a spore. p3 is a big strep two turns away
 * that fans out if left. Tuned with the bots in battle/balance.test.ts.
 */
export function firstBoardLoadout(seed: number, medLevel = 1): Loadout {
  return {
    schema: 1,
    scenario: "first-board",
    seed,
    medLevel,
    exposures: [
      { kind: "strep", size: 2, at: { x: 1, y: 2 } },
      { kind: "aspergillus", size: 3, at: { x: 5, y: 2 } },
      { kind: "strep", size: 3, at: { x: 3, y: 0 } },
      { kind: "strep", size: 2, at: { x: 6, y: 4 } },
    ],
    load: 0,
    reservoirs: [],
    doctorVisit: false,
    energy: 0,
  };
}

/**
 * The T1-T6 board: one leaky and one sealed pathogen, the mold below spore size. Small enough to
 * teach engulf and load in a turn or two; rule tests use it as their fixture.
 */
export function duelLoadout(seed: number, medLevel = 1): Loadout {
  const b = firstBoardLoadout(seed, medLevel);
  return {
    ...b,
    scenario: "duel",
    exposures: [b.exposures[0], { ...b.exposures[1], size: 2 }],
  };
}

/**
 * What a risky week's lake and yard bring when both land: a strep (killable), a staph (a sealed
 * bacterium: round, but engulfing only contains it) and a mold, all inside a charge's size limit.
 */
export function lakeWeekLoadout(seed: number, medLevel = 1): Loadout {
  return {
    ...firstBoardLoadout(seed, medLevel),
    scenario: "lake-week",
    exposures: [
      { kind: "strep", size: 2, at: { x: 1, y: 2 } },
      { kind: "staph", size: 2, at: { x: 3, y: 0 } },
      { kind: "aspergillus", size: 2, at: { x: 5, y: 2 } },
    ],
  };
}

/** A patrol skirmish, its threats drawn from the seed as a campaign draws them from the week. */
export function skirmishLoadout(seed: number, medLevel = 1): Loadout {
  return {
    ...firstBoardLoadout(seed, medLevel),
    scenario: "skirmish",
    kind: "skirmish",
    ...skirmishWaves(skirmishExposures(rngFromSeed(seed))),
  };
}

/**
 * The tutorial's one seed, shared by both parts so the dice line up: on turn 1 the mold grows
 * with no medication (part A) and stalls with it (part B), and in A it telegraphs a spore on turn
 * 2. Pinned by tutorial.test.ts.
 */
export const TUTORIAL_SEED = 54;

/**
 * Arc 1, part A, "before the diagnosis": no medication, no charges, three turns. s1 can engulf the
 * strep on turn 1 (an easy kill), the mold (p1, size 2) grows and spores, and a second mold
 * arrives at (5,0) as the clock runs out. Residual kill chance is 0 here (the loadout wins over the
 * variant's), so no mold can ever be finished: p1 is always on the board, inside a swarm or walled
 * off at the end, whatever is played. Three turns, not four: two germs on the board drain 10 or
 * more tissue over four turns even if left alone, and three keeps a do-nothing player at 12 or
 * more (tutorial.test.ts).
 */
export function tutorialALoadout(seed: number): Loadout {
  return {
    ...tutorialBoard(seed),
    scenario: "tutorial-a",
    medLevel: 0,
    residualKillChance: 0,
    maxTurns: 3,
  };
}

/** The board both tutorial parts share: same germs, same arrival, same seed. */
function tutorialBoard(seed: number): Loadout {
  return {
    schema: 1,
    scenario: "tutorial",
    seed,
    medLevel: 1,
    exposures: [
      { kind: "aspergillus", size: 2, at: { x: 4, y: 1 } },
      { kind: "strep", size: 1, at: { x: 1, y: 3 } },
    ],
    arrivals: [{ turn: 3, kind: "aspergillus", size: 2, door: { x: 5, y: 0 } }],
    load: 0,
    reservoirs: [],
    doctorVisit: false,
    energy: 0,
  };
}

/**
 * Arc 1, part B, "after the diagnosis": part A's board and seed at full medication (the glow, one
 * antibacterial and two antifungal charges), the normal six turns. The mold that grew in A stalls
 * on turn 1; an antifungal charge finishes it, and the second finishes the arrival.
 */
export function tutorialBLoadout(seed: number): Loadout {
  return { ...tutorialBoard(seed), scenario: "tutorial-b" };
}

/** Each named scenario's loadout, for the debug panel to start from. */
export const SCENARIO_LOADOUTS = {
  "first-board": firstBoardLoadout,
  duel: duelLoadout,
  "lake-week": lakeWeekLoadout,
  skirmish: skirmishLoadout,
  "tutorial-a": tutorialALoadout,
  "tutorial-b": tutorialBLoadout,
} as const satisfies Record<
  string,
  (seed: number, medLevel?: number) => Loadout
>;

export type ScenarioName = keyof typeof SCENARIO_LOADOUTS;

/** Each named scenario's opening battle, first telegraph rolled. */
export const SCENARIOS = Object.fromEntries(
  Object.entries(SCENARIO_LOADOUTS).map(([name, loadout]) => [
    name,
    (seed: number) => battleFromLoadout(loadout(seed)),
  ]),
) as Record<ScenarioName, (seed: number) => BattleState>;

export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[];

/** The seed a scenario starts from when the URL names none. */
export function defaultSeedFor(name: ScenarioName): number {
  return name === "tutorial-a" || name === "tutorial-b"
    ? TUTORIAL_SEED
    : PARAMS.defaultSeed;
}

export const DEFAULT_SCENARIO: ScenarioName = "first-board";

export function isScenarioName(name: string): name is ScenarioName {
  return Object.hasOwn(SCENARIO_LOADOUTS, name);
}

/**
 * Load by name (e.g. from a URL parameter), with the first telegraph already rolled.
 * Returns null for an unknown name.
 */
export function loadScenario(
  name: string,
  seed: number = PARAMS.defaultSeed,
): BattleState | null {
  return isScenarioName(name) ? SCENARIOS[name](seed) : null;
}
