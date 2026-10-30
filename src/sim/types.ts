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
  /** A carried-over reservoir not yet revealed (T9/T13). */
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

export interface MedCharges {
  readonly antibacterial: number;
  readonly antifungal: number;
  /** Granted by the doctor visit (T13). */
  readonly strong: number;
}

export interface MedState {
  /** 0..1, from adherence in the life phase. */
  readonly level: number;
  /** 0..1 growth slowdown, set from level at battle setup (T10). */
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

export interface BattleState {
  readonly scenario: string;
  /** 1-based. */
  readonly turn: number;
  readonly maxTurns: number;
  readonly board: Board;
  readonly swarms: readonly Swarm[];
  readonly pathogens: readonly Pathogen[];
  readonly granulomas: readonly Granuloma[];
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

export type BattleOutcome = "cleared" | "contained" | "neededBackup";

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
    };
