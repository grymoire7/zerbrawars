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
  maxPathogenSize: 4,
  /**
   * Per-kind intent behaviour. A pathogen of at least `actMinSize` acts (spreads, or spores if
   * its kind canSpore) with `actChance`, otherwise grows; at max size it always acts if it can.
   * `actCost` is subtracted from the parent's size when the action lands.
   */
  intents: {
    // Bacteria: fast and local. A fresh size-1 bud must grow once before it can spread, which is
    // the player's window; at size 2+ it usually spreads, so an ignored cluster fans out.
    strep: {
      growAmount: 1,
      actMinSize: 2,
      actChance: 0.6,
      actCost: 0,
      childSize: 1,
      sporeMinDistance: 0,
      sporeMaxDistance: 0,
    },
    // Mold: never spreads locally. It grows to 3, then throws a spore 3-4 tiles away and shrinks
    // by 1, so it pulses grow, spore, grow and its threat is a far tile the player must cover.
    aspergillus: {
      growAmount: 1,
      actMinSize: 3,
      actChance: 0.7,
      actCost: 1,
      childSize: 1,
      sporeMinDistance: 3,
      sporeMaxDistance: 4,
    },
  },
  /** Placeholder (T7). */
  maxInflammation: 3,
  /** Placeholder (T7). */
  maxTissueHealth: 20,
  /** Placeholder (T8). */
  maxTurns: 6,
  defaultSeed: 1,
} as const;
