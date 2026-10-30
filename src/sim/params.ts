/** Every tunable number in one place. Values marked placeholder are unused until their task lands. */
export const PARAMS = {
  boardWidth: 7,
  boardHeight: 7,
  swarmCount: 3,
  /**
   * Steps a free swarm can move per turn. 3 lets a swarm on the near edge reach row 3 on turn 1,
   * just in time to stand in a fresh strep spread, but covers at most half a 7x7 board, so a mold
   * spore 3-4 tiles out still has to be anticipated. Load (T5) and inflammation (T7) cut it to 2
   * or 1, which stays readable.
   */
  swarmMoveRange: 3,
  /**
   * Contained pathogens a swarm can hold (a count, not total size). 2 keeps the cap binding with
   * 3 swarms. A full swarm can still engulf leaky pathogens, which die instead of loading.
   */
  loadCap: 2,
  /** Moves lost per contained pathogen: range 3, then 2, then 1. */
  loadedMovePenalty: 1,
  /** Load never slows a free swarm below this. */
  minLoadedMoveRange: 1,
  /**
   * Chance an engulfed sealed pathogen dies instead of loading (residual oxidase activity).
   * XL-like default; the debug panel overrides it per battle via BattleState.residualKillChance.
   */
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
