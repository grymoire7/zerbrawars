import { createBoard } from "./board";
import { PARAMS } from "./params";
import { rngFromSeed } from "./rng";
import type { BattleState } from "./types";

/**
 * First board. Swarms arrive along the near edge. The leaky cluster is one move-and-engulf away
 * from s1 (an early, easy kill); the sealed mold sits in the far corner where s3 can reach it,
 * so turn 1 already asks "grab it and get slow, or leave it to spread?".
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
        size: 2,
        at: { x: 5, y: 2 },
        hidden: false,
      },
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
    nextId: 3,
  };
}

export const SCENARIOS = {
  "first-board": firstBoard,
} as const satisfies Record<string, (seed: number) => BattleState>;

export type ScenarioName = keyof typeof SCENARIOS;

export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[];

export const DEFAULT_SCENARIO: ScenarioName = "first-board";

export function isScenarioName(name: string): name is ScenarioName {
  return Object.hasOwn(SCENARIOS, name);
}

/** Load by name (e.g. from a URL parameter). Returns null for an unknown name. */
export function loadScenario(
  name: string,
  seed: number = PARAMS.defaultSeed,
): BattleState | null {
  return isScenarioName(name) ? SCENARIOS[name](seed) : null;
}
