import { sameCoord } from "../board";
import { PARAMS } from "../params";
import type { PathogenKindId } from "../pathogens";
import type { Coord } from "../types";
import { battleDueReasons, weekOver } from "./calendar";
import { cardDef } from "./cards";
import type { BattleReason, LifeState } from "./types";

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

/** The battle's seed: fixed by the life seed and week, whatever was played. */
export function battleSeed(life: LifeState): number {
  return (
    (Math.imul(life.seed ^ PARAMS.life.battleSeedSalt, 0x85ebca6b) +
      life.week) >>>
    0
  );
}

/**
 * Builds the battle's loadout from the life phase as it stands (normally once the week is over):
 * the week-end med level, every pathogen that landed, the carried reservoirs, the doctor flag and
 * the energy left. Flared reservoirs start visible. Each exposure takes the first tile of its card's `at` list not yet taken, else
 * the setup default. `load` stays 0.
 */
export function loadoutFromLife(life: LifeState): Loadout {
  const taken: Coord[] = [];
  const exposures = life.exposures.map((e): Exposure => {
    const at = cardDef(e.card).exposure.at.find(
      (c) => !taken.some((t) => sameCoord(t, c)),
    );
    if (at) taken.push(at);
    return at
      ? { kind: e.kind, size: e.size, at }
      : { kind: e.kind, size: e.size };
  });
  // Exposures without a tile fall back to setup's list; keep it from reusing a card tile.
  const fallback = PARAMS.setup.exposureTiles.filter(
    (c) => !taken.some((t) => sameCoord(t, c)),
  );
  return {
    schema: 1,
    scenario: `life-week-${life.week}`,
    seed: battleSeed(life),
    medLevel: life.medLevel,
    exposures: exposures.map((e) =>
      e.at ? e : { ...e, at: fallback.shift() as Coord },
    ),
    load: 0,
    // A flared reservoir is an active infection now, so it starts visible.
    reservoirs: life.reservoirs.map((r) => {
      const c: CarriedReservoir = {
        kind: r.kind,
        size: r.size,
        hidden: r.hidden && !r.flared,
      };
      return r.at ? { ...c, at: r.at } : c;
    }),
    doctorVisit: life.flags.doctorVisit,
    energy: life.energy,
  };
}

export interface BattleDue {
  readonly due: boolean;
  readonly reasons: readonly BattleReason[];
  /** Every die is rolled and nothing landed or flared. */
  readonly quietWeek: boolean;
}

export function battleDue(life: LifeState): BattleDue {
  const reasons = battleDueReasons(life);
  return {
    due: reasons.length > 0,
    reasons,
    quietWeek: weekOver(life) && reasons.length === 0,
  };
}
