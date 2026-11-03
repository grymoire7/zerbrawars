import { sameCoord } from "../board";
import { PARAMS } from "../params";
import type { PathogenKindId } from "../pathogens";
import { rngInt, type RngState } from "../rng";
import type { Arrival, BattleKind, Coord } from "../types";
import { missedDosesOf } from "./meds";
import { battleDueReasons, battleKindOf, weekOver } from "./calendar";
import { cardDef } from "./cards";
import type { BattleReason, LifeState } from "./types";

// The only bridge from the life phase into a battle: plain JSON, read by battleFromLoadout
// (battle/setup.ts). The debug panel and scenario presets build one directly.

/** One pathogen brought in by an activity this week. */
export interface Exposure {
  readonly kind: PathogenKindId;
  /** Starting size before the loadout's `load` bonus. */
  readonly size: number;
  /** Where it enters; omitted = the first free tile of PARAMS.setup.doors. */
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
  /** Omitted = "full". A skirmish plays PARAMS.campaign.skirmish.maxTurns turns. */
  readonly kind?: BattleKind;
  readonly seed: number;
  /** 0..1 adherence over the last days; sets the aura and the support charges. */
  readonly medLevel: number;
  readonly exposures: readonly Exposure[];
  /** Later groups (see Arrival); omitted = none, so the battle is just its exposures. */
  readonly arrivals?: readonly Arrival[];
  /**
   * Doses missed in the med window before the battle (loadoutFromLife sets it): added to the size
   * of every exposure and arrival, first and second groups alike (capped at PARAMS.maxPathogenSize;
   * reservoirs are not affected). 0 = as listed.
   */
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
 * A skirmish's threats: PARAMS.campaign.skirmish.threats, count and distinct tiles drawn from
 * `rng` (the week-end life rng in a campaign, the seed in the named scenario).
 */
export function skirmishExposures(rng: RngState): Exposure[] {
  const S = PARAMS.campaign.skirmish;
  let r = rngInt(rng, S.threats.max - S.threats.min + 1);
  const count = S.threats.min + r.value;
  const tiles: Coord[] = [...S.tiles];
  const out: Exposure[] = [];
  for (let i = 0; i < count; i++) {
    r = rngInt(r.rng, tiles.length);
    const [at] = tiles.splice(r.value, 1);
    out.push({ kind: S.threats.kind, size: S.threats.size, at });
  }
  return out;
}

/**
 * A skirmish's threats in two groups: the first PARAMS.waves.skirmishFirst start on the board, the
 * rest arrive PARAMS.waves.skirmishDelay turns later at the tile they were drawn on.
 */
export function skirmishWaves(
  threats: readonly Exposure[],
): Pick<Loadout, "exposures" | "arrivals"> {
  const W = PARAMS.waves;
  return {
    exposures: threats.slice(0, W.skirmishFirst),
    arrivals: threats.slice(W.skirmishFirst).map((e) => ({
      turn: 1 + W.skirmishDelay,
      kind: e.kind,
      size: e.size,
      door: e.at as Coord,
    })),
  };
}

/**
 * A full battle's second groups: one per exposure (at most PARAMS.waves.maxSecondGroups), `PARAMS.waves.delay` turns in, a size smaller
 * (at least 1), each at the first door of PARAMS.setup.doors that no earlier arrival uses,
 * preferring doors no exposure starts on. A group with no door left is dropped.
 */
export function fullWaves(exposures: readonly Exposure[]): Arrival[] {
  const W = PARAMS.waves;
  const starts: Coord[] = exposures.flatMap((e) => (e.at ? [e.at] : []));
  const used: Coord[] = [];
  const free = (d: Coord, list: readonly Coord[]) =>
    !list.some((u) => sameCoord(u, d));
  return exposures.slice(0, W.maxSecondGroups).flatMap((e): Arrival[] => {
    const door =
      PARAMS.setup.doors.find((d) => free(d, used) && free(d, starts)) ??
      PARAMS.setup.doors.find((d) => free(d, used));
    if (!door) return [];
    used.push(door);
    return [
      {
        turn: 1 + W.delay,
        kind: e.kind,
        size: Math.max(1, e.size - W.sizeDrop),
        door,
      },
    ];
  });
}

/**
 * Builds the battle's loadout from the life phase as it stands (normally once the week is over):
 * the week-end med level, every pathogen that landed, the carried reservoirs, the doctor flag and
 * the energy left. Flared reservoirs start visible. Each exposure takes the first tile of its
 * card's `at` list not yet taken, else the setup default. `load` is the doses missed in the med window. Once the week is over
 * with a skirmish due, it is the skirmish's instead: its threats only, carried reservoirs left off
 * the board (they carry on as they are).
 */
export function loadoutFromLife(life: LifeState): Loadout {
  if (weekOver(life) && battleKindOf(life) === "skirmish") {
    return {
      schema: 1,
      scenario: `life-week-${life.week}-skirmish`,
      kind: "skirmish",
      seed: battleSeed(life),
      medLevel: life.medLevel,
      ...skirmishWaves(skirmishExposures(life.rng)),
      load: missedDosesOf(life.doses),
      reservoirs: [],
      doctorVisit: false,
      energy: life.energy,
    };
  }
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
  const fallback = PARAMS.setup.doors.filter(
    (c) => !taken.some((t) => sameCoord(t, c)),
  );
  const placed = exposures.map((e) =>
    e.at ? e : { ...e, at: fallback.shift() as Coord },
  );
  return {
    schema: 1,
    scenario: `life-week-${life.week}`,
    kind: "full",
    seed: battleSeed(life),
    medLevel: life.medLevel,
    exposures: placed,
    arrivals: fullWaves(placed),
    load: missedDosesOf(life.doses),
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
  /** Always, except a viral doctor visit in a week where nothing landed (see battleKindOf). */
  readonly due: boolean;
  /** Full with any reason, else a skirmish; null when not due. Mid-week, as it stands so far. */
  readonly battleKind: BattleKind | null;
  /** Why it is a full battle; empty for a skirmish. */
  readonly reasons: readonly BattleReason[];
}

export function battleDue(life: LifeState): BattleDue {
  const battleKind = battleKindOf(life);
  return {
    due: battleKind !== null,
    battleKind,
    reasons: battleDueReasons(life),
  };
}
