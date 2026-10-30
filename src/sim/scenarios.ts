import { battleFromLoadout } from "./battle/setup";
import type { Loadout } from "./life/loadout";
import { PARAMS } from "./params";
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

/** Each named scenario's loadout, for the debug panel to start from. */
export const SCENARIO_LOADOUTS = {
  "first-board": firstBoardLoadout,
  duel: duelLoadout,
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
