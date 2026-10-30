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
  /**
   * Turns a swarm stays busy after the turn it walls off (it cannot move, engulf or wall off).
   * The wall-off turn itself is spent too, so walling costs the swarm two turns of action.
   */
  wallOffBusyTurns: 1,
  /**
   * Per-tile inflammation, an integer 0..maxInflammation, ticked once a turn after the pathogens
   * act. A tile rises by the sum of its causes, otherwise it decays:
   * - crowding: each swarm adds `crowdRise` to its tile per other swarm touching it (8
   *   neighbours, so diagonal counts). Three swarms in a clump heat the middle one by 2. The
   *   starting line (two tiles apart) does not crowd.
   * - load: a swarm carrying anything adds `loadRise` to its tile, so a loaded swarm that stands
   *   still heats up (1, 2, 3) while one that keeps moving leaves only 1s that fade.
   * - infection: each visible pathogen adds `pathogenRise` to its own tile, so an ignored
   *   pathogen costs 0, 1, then 2 tissue a turn.
   * - granuloma: adds `granulomaRise` the turn it is walled, and its tile never decays below
   *   `granulomaInflammation`. Walling a load that was heating its tile costs about 1 tissue.
   * Effects: a swarm starting its turn on a tile at `slowThreshold`+ loses `inflammationMovePenalty`
   * moves (never below minLoadedMoveRange); every tile drains `damagePerLevel` tissue health per
   * level above `damageThreshold` each tick. Pathogens never read inflammation, so the telegraph
   * stays exact.
   */
  maxInflammation: 3,
  inflammation: {
    crowdRise: 1,
    loadRise: 1,
    pathogenRise: 1,
    granulomaRise: 1,
    granulomaInflammation: 1,
    decay: 1,
    slowThreshold: 2,
    inflammationMovePenalty: 1,
    damageThreshold: 1,
    damagePerLevel: 1,
  },
  /**
   * Each turn a swarm carries a sealed pathogen loaded on an earlier turn, it gets the residual
   * kill roll again (times this scale), so a carried load can still die. This is the only road to
   * "cleared" once a sealed pathogen is engulfed. Walled contents never roll: walling trades the
   * chance to clear for a free swarm. 1 = the same per-character chance; 0 turns it off.
   */
  carriedKillScale: 1,
  maxTissueHealth: 20,
  /** The battle ends after this many turns, or sooner once no visible pathogen is left. */
  maxTurns: 6,
  outcome: {
    /**
     * At or below this tissue health the grade is neededBackup whatever else is true. Half of 20:
     * a do-nothing battle loses all 20; careful play typically ends at 16-17.
     */
    backupTissueHealth: 10,
    /** Energy carried into the life phase per grade (T13). */
    energy: { cleared: 3, contained: 2, neededBackup: 1 },
  },
  defaultSeed: 1,
} as const;
