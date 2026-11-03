import type { PathogenKindId, Wall } from "./pathogens";
import type { RngState } from "./rng";

// All sim state is plain JSON data: no classes, Maps, Sets or functions.
// Collections are arrays kept in a stable order (ids ascending) so output is deterministic.

/** x is the column (0 = left), y is the row (0 = far edge, height-1 = near the camera). */
export interface Coord {
  readonly x: number;
  readonly y: number;
}

/** Row-major tile index: y * width + x. */
export type TileId = number;

export type SwarmId = string;
export type PathogenId = string;
export type GranulomaId = string;

export interface Tile {
  /** 0..PARAMS.maxInflammation. Integer so the tint has a small, readable number of steps. */
  readonly inflammation: number;
}

export interface Board {
  readonly width: number;
  readonly height: number;
  /** Indexed by TileId. */
  readonly tiles: readonly Tile[];
}

/** A sealed pathogen held in a swarm or granuloma. Left at battle end, it becomes a reservoir. */
export interface Contained {
  readonly kind: PathogenKindId;
  readonly size: number;
}

/**
 * Deliberately no cell count or hit points: neutrophil numbers are normal in CGD and swarms always
 * arrive. What varies is what they carry.
 */
export interface Swarm {
  readonly id: SwarmId;
  readonly at: Coord;
  readonly load: readonly Contained[];
  /** Turns left before the swarm can act again (walling off, T7). 0 = free. */
  readonly busyTurns: number;
}

export interface Pathogen {
  readonly id: PathogenId;
  /** Key into PATHOGEN_KINDS; wall, form and names come from there. */
  readonly kind: PathogenKindId;
  readonly size: number;
  readonly at: Coord;
  /**
   * A carried-over reservoir not yet revealed. It never acts, inflames or blocks movement checks;
   * a swarm that steps next to it reveals it and stops (see applyMoves).
   */
  readonly hidden: boolean;
}

export interface Granuloma {
  readonly id: GranulomaId;
  readonly at: Coord;
  readonly contents: readonly Contained[];
}

/**
 * Pathogen intents. Every random choice (which intent, which tile) is already made here,
 * so the telegraph shows exactly what will happen.
 */
export type Intent =
  | {
      readonly type: "grow";
      readonly pathogenId: PathogenId;
      readonly amount: number;
    }
  | {
      readonly type: "spread";
      readonly pathogenId: PathogenId;
      readonly to: Coord;
      /** Size of the new pathogen. */
      readonly size: number;
      /** Taken off the parent's size if the action lands (not when blocked). */
      readonly cost: number;
    }
  | {
      readonly type: "spore";
      readonly pathogenId: PathogenId;
      readonly to: Coord;
      readonly size: number;
      readonly cost: number;
    }
  | {
      /** Held back by the medication aura: it does nothing this turn (and emits no event). */
      readonly type: "stall";
      readonly pathogenId: PathogenId;
    };

/** At most one order per swarm per turn; a swarm with no order holds. */
export type Order =
  | { readonly type: "move"; readonly swarmId: SwarmId; readonly to: Coord }
  | { readonly type: "hold"; readonly swarmId: SwarmId }
  | {
      readonly type: "engulf";
      readonly swarmId: SwarmId;
      readonly pathogenId: PathogenId;
      /** Tile to move to first (null = engulf from where it stands). Target must be adjacent to it. */
      readonly from: Coord | null;
    }
  | { readonly type: "wallOff"; readonly swarmId: SwarmId };

export type ChargeKind = "antibacterial" | "antifungal" | "strong";

/**
 * Spending one support charge. Not tied to a swarm, and at most one per turn, so it is passed to
 * resolveTurn beside the swarm orders rather than inside them.
 * - pathogen: kills a visible pathogen anywhere. Antibacterial takes leaky ones, antifungal sealed
 *   ones, strong either.
 * - load: kills the oldest pathogen a swarm carries (antifungal or strong; only sealed ones are
 *   ever carried).
 */
export type SupportOrder =
  | {
      readonly type: "support";
      readonly charge: ChargeKind;
      readonly target: "pathogen";
      readonly pathogenId: PathogenId;
    }
  | {
      readonly type: "support";
      readonly charge: ChargeKind;
      readonly target: "load";
      readonly swarmId: SwarmId;
    };

export interface MedCharges {
  readonly antibacterial: number;
  readonly antifungal: number;
  /** Granted by the doctor visit (T13). */
  readonly strong: number;
}

export interface MedState {
  /** 0..1, from adherence in the life phase. */
  readonly level: number;
  /**
   * 0..1 aura strength, equal to the level at setup. Each turn every visible pathogen stalls with
   * chance aura * PARAMS.meds.auraStallChance (rolled with its intent), so even a full aura only
   * slows pathogens and never stops them.
   */
  readonly aura: number;
  readonly charges: MedCharges;
}

/**
 * Separate streams so a resolution-time roll (residual kill) never shifts which intents
 * the pathogens pick. Same seed + different orders = same enemy behaviour.
 */
export interface BattleRng {
  readonly intents: RngState;
  readonly resolution: RngState;
}

/**
 * A group of one pathogen kind due at a door on `turn` (it lands in that turn's intents phase,
 * after the player's orders). A swarm standing on the door blocks it: a leaky group dies there, a
 * sealed one comes back next turn at the nearest free door. A door that is taken some other way
 * (a pathogen or granuloma on it) also sends the group on to the next turn.
 */
export interface Arrival {
  readonly turn: number;
  readonly kind: PathogenKindId;
  readonly size: number;
  readonly door: Coord;
}

/** A full battle (something landed, flared or was found), or the always-on patrol's skirmish. */
export type BattleKind = "full" | "skirmish";

export interface BattleState {
  readonly scenario: string;
  readonly kind: BattleKind;
  /** 1-based. */
  readonly turn: number;
  readonly maxTurns: number;
  readonly board: Board;
  readonly swarms: readonly Swarm[];
  readonly pathogens: readonly Pathogen[];
  readonly granulomas: readonly Granuloma[];
  /** Groups still to arrive, in turn order. The battle is not over while any are pending. */
  readonly arrivals: readonly Arrival[];
  /** Telegraphed intents for the coming resolve, at most one per pathogen. */
  readonly intents: readonly Intent[];
  readonly meds: MedState;
  readonly tissueHealth: number;
  /** Per-character residual oxidase activity, 0..1. */
  readonly residualKillChance: number;
  readonly rng: BattleRng;
  /** Counter for ids of entities created mid-battle (spread, spore, granuloma). */
  readonly nextId: number;
}

export type BattleGrade = "cleared" | "contained" | "neededBackup";

export interface BattleStatus {
  readonly over: boolean;
  /** Why it ended; null while it goes on. */
  readonly reason: "noFreePathogens" | "maxTurns" | "backup" | null;
  /** Turns still to play, counting the current one. 0 once over. */
  readonly turnsLeft: number;
}

/** Something still alive at battle end that carries over (T13). */
export interface Reservoir extends Contained {
  /** A swarm's load, a granuloma's contents, or a hidden token never revealed. */
  readonly source: "swarm" | "granuloma" | "hidden";
  /** Swarm, granuloma or pathogen id. */
  readonly sourceId: string;
}

export interface BattleOutcome {
  readonly grade: BattleGrade;
  /** Why the grade is neededBackup; empty otherwise. */
  readonly backupReasons: readonly ("tissue" | "freePathogens")[];
  /** Visible pathogens still on the board. */
  readonly freePathogens: number;
  readonly reservoirs: readonly Reservoir[];
  readonly tissue: {
    readonly health: number;
    readonly max: number;
    readonly lost: number;
  };
  /** Energy carried into the life phase. */
  readonly energy: number;
  /** Turns resolved. */
  readonly turnsPlayed: number;
}

export type Mode = "life" | "battle" | "outcome";

/** Top-level state. LifeState and campaign fields land with T11/T13. */
export interface GameState {
  readonly schema: 1;
  readonly mode: Mode;
  /** Life-phase and campaign stream; each battle seeds its own BattleRng. */
  readonly rng: RngState;
  readonly battle: BattleState | null;
}

export type SimEvent =
  | {
      readonly type: "SwarmMoved";
      readonly swarmId: SwarmId;
      readonly path: readonly Coord[];
    }
  | {
      readonly type: "Engulfed";
      readonly swarmId: SwarmId;
      readonly pathogenId: PathogenId;
      readonly wall: Wall;
    }
  | {
      readonly type: "Killed";
      readonly pathogenId: PathogenId;
      readonly at: Coord;
      readonly cause: "engulf" | "charge";
    }
  | {
      readonly type: "Loaded";
      readonly swarmId: SwarmId;
      readonly load: readonly Contained[];
    }
  | {
      readonly type: "ResidualKill";
      readonly swarmId: SwarmId;
      readonly chance: number;
      readonly success: boolean;
    }
  | {
      readonly type: "Grew";
      readonly pathogenId: PathogenId;
      readonly size: number;
    }
  | {
      readonly type: "Spread";
      readonly pathogenId: PathogenId;
      readonly newPathogenId: PathogenId;
      readonly from: Coord;
      readonly to: Coord;
      readonly size: number;
      /** The parent's size afterwards. */
      readonly parentSize: number;
    }
  | {
      readonly type: "Spored";
      readonly pathogenId: PathogenId;
      readonly newPathogenId: PathogenId;
      readonly from: Coord;
      readonly to: Coord;
      readonly size: number;
      /** The parent's size afterwards. */
      readonly parentSize: number;
    }
  | {
      /** A swarm standing on the target tile stopped a spread or spore. */
      readonly type: "Blocked";
      readonly pathogenId: PathogenId;
      readonly intent: "spread" | "spore";
      readonly at: Coord;
      readonly swarmId: SwarmId;
    }
  | {
      /** A group arrived at its door (see Arrival). */
      readonly type: "Arrived";
      readonly pathogenId: PathogenId;
      readonly kind: PathogenKindId;
      readonly size: number;
      readonly at: Coord;
    }
  | {
      /**
       * An arrival could not land on `at`: a swarm stood there (swarmId) or something else did
       * (null). "died" = a leaky group met a swarm; "delayed" = it tries again next turn.
       */
      readonly type: "ArrivalBlocked";
      readonly kind: PathogenKindId;
      readonly size: number;
      readonly at: Coord;
      readonly swarmId: SwarmId | null;
      readonly fate: "died" | "delayed";
    }
  | {
      readonly type: "Walled";
      readonly swarmId: SwarmId;
      readonly granulomaId: GranulomaId;
      readonly at: Coord;
    }
  | {
      readonly type: "InflammationChanged";
      readonly at: Coord;
      readonly inflammation: number;
    }
  | {
      readonly type: "TissueDamaged";
      readonly amount: number;
      readonly tissueHealth: number;
    }
  | {
      /**
       * A moving swarm stepped next to a hidden token: the token turns visible and the swarm
       * stops there (its SwarmMoved path ends on that tile). A doctor visit reveals tokens at
       * setup instead, with no event.
       */
      readonly type: "Revealed";
      readonly pathogenId: PathogenId;
      readonly at: Coord;
      readonly kind: PathogenKindId;
      readonly size: number;
      readonly swarmId: SwarmId;
    }
  | {
      /**
       * A support charge was spent. Followed by Killed (cause "charge") for a pathogen target, or
       * Loaded with what is left for a load target.
       */
      readonly type: "SupportUsed";
      readonly charge: ChargeKind;
      readonly target: "pathogen" | "load";
      readonly at: Coord;
      readonly pathogenId: PathogenId | null;
      readonly swarmId: SwarmId | null;
    };
