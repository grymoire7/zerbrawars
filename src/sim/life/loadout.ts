import type { PathogenKindId } from "../pathogens";
import type { Coord } from "../types";

// The only bridge from the life phase into a battle: plain JSON, read by battleFromLoadout
// (battle/setup.ts). The debug panel and scenario presets build one directly.

/** One pathogen brought in by an activity this week. */
export interface Exposure {
  readonly kind: PathogenKindId;
  /** Starting size before the loadout's `load` bonus. */
  readonly size: number;
  /** Where it enters; omitted = the first free tile of PARAMS.setup.exposureTiles. */
  readonly at?: Coord;
}

/** Something left from an earlier battle that starts this one on the board. */
export interface CarriedReservoir {
  readonly kind: PathogenKindId;
  readonly size: number;
  /** Starts as a hidden token unless a doctor visit reveals it. */
  readonly hidden: boolean;
  /** Omitted = the first free tile of PARAMS.setup.reservoirTiles. */
  readonly at?: Coord;
}

export interface Loadout {
  readonly schema: 1;
  /** Label carried into BattleState.scenario. */
  readonly scenario: string;
  readonly seed: number;
  /** 0..1 adherence over the last days; sets the aura and the support charges. */
  readonly medLevel: number;
  readonly exposures: readonly Exposure[];
  /** Exposure dose: added to every exposure's size (capped at the max size). 0 = as listed. */
  readonly load: number;
  /** At most PARAMS.setup.maxReservoirs are used, in list order. */
  readonly reservoirs: readonly CarriedReservoir[];
  /** Reveals every hidden token and adds PARAMS.meds.doctorStrongCharges strong charges. */
  readonly doctorVisit: boolean;
  /** Game-only life-phase resource. The battle does not read it; the outcome adds to it. */
  readonly energy: number;
  /** Per-character residual oxidase activity; omitted = PARAMS.residualKillChance. */
  readonly residualKillChance?: number;
}
