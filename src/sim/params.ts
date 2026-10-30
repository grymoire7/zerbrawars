/** Every tunable number in one place. Values marked placeholder are unused until their task lands. */
export const PARAMS = {
  boardWidth: 7,
  boardHeight: 7,
  swarmCount: 3,
  /** Tiles a free swarm can move per turn. */
  swarmMoves: 3,
  /** Placeholder (T5). Contained pathogens a swarm can hold. 2 keeps the cap binding with 3 swarms. */
  loadCap: 2,
  /** Placeholder (T5). Moves lost per turn while a swarm holds any load. */
  loadedMovePenalty: 1,
  /** Placeholder (T5). XL-like default; the debug panel overrides it. */
  residualKillChance: 0.1,
  /** Placeholder (T3). */
  maxPathogenSize: 4,
  /** Placeholder (T7). */
  maxInflammation: 3,
  /** Placeholder (T7). */
  maxTissueHealth: 20,
  /** Placeholder (T8). */
  maxTurns: 6,
  defaultSeed: 1,
} as const;
