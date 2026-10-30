import { initBattle } from "./battle/intents";
import { createBoard } from "./board";
import { PARAMS } from "./params";
import { rngFromSeed } from "./rng";
import type { BattleState } from "./types";

/**
 * First board. Swarms arrive along the near edge. p1 (leaky) is one move-and-engulf from s1, an
 * early easy kill. The sealed mold p2 starts at spore size, so turn 1 already telegraphs a spore
 * (70%) and s3 must choose: engulf it now (cancels the spore, loads and slows s3, and starts the
 * carried kill rolls that are the only road to "cleared") or kill p4, the strep next to it, and
 * deal with a spore. p3 is a big strep two turns away that fans out if left. Tuned with the bots
 * in battle/balance.test.ts.
 */
function firstBoard(seed: number): BattleState {
  return {
    scenario: "first-board",
    turn: 1,
    maxTurns: PARAMS.maxTurns,
    board: createBoard(PARAMS.boardWidth, PARAMS.boardHeight),
    swarms: [
      { id: "s1", at: { x: 1, y: 6 }, load: [], busyTurns: 0 },
      { id: "s2", at: { x: 3, y: 6 }, load: [], busyTurns: 0 },
      { id: "s3", at: { x: 5, y: 6 }, load: [], busyTurns: 0 },
    ],
    pathogens: [
      { id: "p1", kind: "strep", size: 2, at: { x: 1, y: 2 }, hidden: false },
      {
        id: "p2",
        kind: "aspergillus",
        size: 3,
        at: { x: 5, y: 2 },
        hidden: false,
      },
      { id: "p3", kind: "strep", size: 3, at: { x: 3, y: 0 }, hidden: false },
      { id: "p4", kind: "strep", size: 2, at: { x: 6, y: 4 }, hidden: false },
    ],
    granulomas: [],
    intents: [],
    meds: {
      level: 1,
      aura: 1,
      charges: { antibacterial: 1, antifungal: 1, strong: 0 },
    },
    tissueHealth: PARAMS.maxTissueHealth,
    residualKillChance: PARAMS.residualKillChance,
    rng: {
      intents: rngFromSeed(seed),
      resolution: rngFromSeed(seed ^ 0x9e3779b9),
    },
    nextId: 5,
  };
}

/**
 * The T1-T6 board: one leaky and one sealed pathogen, the mold below spore size. Small enough to
 * teach engulf and load in a turn or two; rule tests use it as their fixture.
 */
function duel(seed: number): BattleState {
  const b = firstBoard(seed);
  return {
    ...b,
    scenario: "duel",
    pathogens: b.pathogens
      .filter((p) => p.id === "p1" || p.id === "p2")
      .map((p) => (p.id === "p2" ? { ...p, size: 2 } : p)),
    nextId: 3,
  };
}

export const SCENARIOS = {
  "first-board": firstBoard,
  duel,
} as const satisfies Record<string, (seed: number) => BattleState>;

export type ScenarioName = keyof typeof SCENARIOS;

export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[];

export const DEFAULT_SCENARIO: ScenarioName = "first-board";

export function isScenarioName(name: string): name is ScenarioName {
  return Object.hasOwn(SCENARIOS, name);
}

/**
 * Load by name (e.g. from a URL parameter), with the first telegraph already rolled.
 * Returns null for an unknown name.
 */
export function loadScenario(
  name: string,
  seed: number = PARAMS.defaultSeed,
): BattleState | null {
  return isScenarioName(name) ? initBattle(SCENARIOS[name](seed)) : null;
}
