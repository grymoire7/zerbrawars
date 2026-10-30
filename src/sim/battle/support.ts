import { PARAMS } from "../params";
import { pathogenKind, type PathogenKindId } from "../pathogens";
import type {
  BattleState,
  ChargeKind,
  Contained,
  Coord,
  Intent,
  Order,
  SimEvent,
  SupportOrder,
} from "../types";
import { inflammationAt } from "./inflammation";
import { moveRange, validateOrders, validEngulfs } from "./orders";

// Support charges: at most one per turn, passed beside the swarm orders. They resolve after
// moves and before engulfs, so a charged pathogen's intent is cancelled like an engulfed one's.

export const CHARGE_KINDS: readonly ChargeKind[] = [
  "antibacterial",
  "antifungal",
  "strong",
];

/**
 * Whether a charge works on a kind. Keyed on growth form, not on wall: an antibacterial treats a
 * sealed bacterium (Staph) too, and an antifungal never touches bacteria. Strong covers both.
 */
export function chargeCovers(
  charge: ChargeKind,
  kind: PathogenKindId,
): boolean {
  if (charge === "strong") return true;
  const form = pathogenKind(kind).form;
  return charge === "antibacterial" ? form === "bacterium" : form === "mold";
}

/** The largest pathogen (board or carried) a charge can kill. */
export function chargeMaxSize(charge: ChargeKind): number {
  return charge === "strong"
    ? PARAMS.meds.strongMaxSize
    : PARAMS.meds.chargeMaxSize;
}

/** Charges with at least one use left, in CHARGE_KINDS order. */
export function availableCharges(battle: BattleState): ChargeKind[] {
  return CHARGE_KINDS.filter((c) => battle.meds.charges[c] > 0);
}

/** Index of the load entry a load-target charge would clear: the oldest it can kill, or -1. */
function loadIndex(load: readonly Contained[], charge: ChargeKind): number {
  return load.findIndex(
    (c) => chargeCovers(charge, c.kind) && c.size <= chargeMaxSize(charge),
  );
}

/**
 * Null when `support` is legal alongside the (valid) swarm `orders`, else a reason. Hidden and
 * missing pathogens read the same, so a rejection never leaks a hidden token.
 * - The charge needs a use left.
 * - pathogen: visible, a kind the charge covers, no bigger than chargeMaxSize, and not being
 *   engulfed this turn.
 * - load: the swarm carries something the charge covers and is small enough, and is not walling
 *   off this turn. The oldest such entry dies.
 */
export function supportProblem(
  battle: BattleState,
  orders: readonly Order[],
  support: SupportOrder,
): string | null {
  const charge = support.charge;
  if (!CHARGE_KINDS.includes(charge)) return `unknown charge ${charge}`;
  if (battle.meds.charges[charge] <= 0) return `no ${charge} charge left`;
  if (support.target === "pathogen") {
    const p = battle.pathogens.find((q) => q.id === support.pathogenId);
    if (!p || p.hidden) return `no pathogen ${support.pathogenId}`;
    if (!chargeCovers(charge, p.kind)) {
      return `${charge} does not work on ${pathogenKind(p.kind).label} ${p.id}`;
    }
    const max = chargeMaxSize(charge);
    if (p.size > max)
      return `${p.id} is too big for ${charge} (size ${p.size}, max ${max})`;
    const engulf = validEngulfs(battle, orders).find(
      (e) => e.pathogen.id === p.id,
    );
    if (engulf) return `${engulf.order.swarmId} is already engulfing ${p.id}`;
    return null;
  }
  const swarm = battle.swarms.find((s) => s.id === support.swarmId);
  if (!swarm) return `no swarm ${support.swarmId}`;
  if (swarm.load.length === 0) return `${swarm.id} carries nothing`;
  if (loadIndex(swarm.load, charge) < 0) {
    return `${charge} cannot clear what ${swarm.id} carries`;
  }
  const walling = validateOrders(battle, orders).some(
    (c) =>
      c.reason === null &&
      c.order.type === "wallOff" &&
      c.order.swarmId === swarm.id,
  );
  if (walling) return `${swarm.id} is walling off`;
  return null;
}

/** `battle` with the load entry `support` would clear already gone (for carried-kill counting). */
export function withoutClearedLoad(
  battle: BattleState,
  support: SupportOrder | null,
): BattleState {
  if (support?.target !== "load") return battle;
  return {
    ...battle,
    swarms: battle.swarms.map((s) => {
      if (s.id !== support.swarmId) return s;
      const i = loadIndex(s.load, support.charge);
      return i < 0 ? s : { ...s, load: s.load.filter((_, k) => k !== i) };
    }),
  };
}

/**
 * Spends the charge on `after` (the state after moves), checked against `before`: SupportUsed,
 * then Killed (cause "charge") with the pathogen and its intent removed, or Loaded with what the
 * swarm still carries. Does nothing for a null or invalid support.
 */
export function applySupport(
  before: BattleState,
  after: BattleState,
  orders: readonly Order[],
  support: SupportOrder | null,
): { state: BattleState; events: SimEvent[] } {
  if (!support || supportProblem(before, orders, support) !== null) {
    return { state: after, events: [] };
  }
  const charges = {
    ...after.meds.charges,
    [support.charge]: after.meds.charges[support.charge] - 1,
  };
  const meds = { ...after.meds, charges };
  if (support.target === "pathogen") {
    const p = after.pathogens.find((q) => q.id === support.pathogenId);
    if (!p) return { state: after, events: [] };
    return {
      state: {
        ...after,
        meds,
        pathogens: after.pathogens.filter((q) => q.id !== p.id),
        intents: after.intents.filter((i) => i.pathogenId !== p.id),
      },
      events: [
        {
          type: "SupportUsed",
          charge: support.charge,
          target: "pathogen",
          at: p.at,
          pathogenId: p.id,
          swarmId: null,
        },
        { type: "Killed", pathogenId: p.id, at: p.at, cause: "charge" },
      ],
    };
  }
  const cleared = withoutClearedLoad(after, support);
  const swarm = cleared.swarms.find((s) => s.id === support.swarmId);
  if (!swarm) return { state: after, events: [] };
  return {
    state: { ...cleared, meds },
    events: [
      {
        type: "SupportUsed",
        charge: support.charge,
        target: "load",
        at: swarm.at,
        pathogenId: null,
        swarmId: swarm.id,
      },
      { type: "Loaded", swarmId: swarm.id, load: swarm.load },
    ],
  };
}

export interface SupportPreview {
  /** null = valid. When set, the other fields still describe the would-be result. */
  readonly reason: string | null;
  readonly charge: ChargeKind;
  /** Uses of this charge left after spending it. */
  readonly chargesLeft: number;
  /** The tile it lands on: the pathogen's, or the swarm's current tile. */
  readonly at: Coord;
  /** What dies. */
  readonly kills: Contained;
  /** The pathogen's telegraphed intent, which will not happen (pathogen target only). */
  readonly cancels: Intent | null;
  /** Load target: the swarm's load once cleared, and its move range from its current tile. */
  readonly loadAfter: readonly Contained[] | null;
  readonly moveRangeAfter: number | null;
}

/**
 * What `support` would do alongside the pending swarm `orders`. Returns null only when its target
 * does not exist, is hidden, or (load) holds nothing the charge covers.
 */
export function supportPreview(
  battle: BattleState,
  orders: readonly Order[],
  support: SupportOrder,
): SupportPreview | null {
  const reason = supportProblem(battle, orders, support);
  const chargesLeft = Math.max(
    0,
    (battle.meds.charges[support.charge] ?? 0) - 1,
  );
  if (support.target === "pathogen") {
    const p = battle.pathogens.find((q) => q.id === support.pathogenId);
    if (!p || p.hidden) return null;
    return {
      reason,
      charge: support.charge,
      chargesLeft,
      at: p.at,
      kills: { kind: p.kind, size: p.size },
      cancels: battle.intents.find((i) => i.pathogenId === p.id) ?? null,
      loadAfter: null,
      moveRangeAfter: null,
    };
  }
  const swarm = battle.swarms.find((s) => s.id === support.swarmId);
  const i = swarm ? loadIndex(swarm.load, support.charge) : -1;
  if (!swarm || i < 0) return null;
  const loadAfter = swarm.load.filter((_, k) => k !== i);
  return {
    reason,
    charge: support.charge,
    chargesLeft,
    at: swarm.at,
    kills: swarm.load[i],
    cancels: null,
    loadAfter,
    moveRangeAfter: moveRange(
      { busyTurns: 0, load: loadAfter },
      inflammationAt(battle, swarm.at),
    ),
  };
}

/**
 * Every legal use of `charge` given the pending swarm `orders`: visible pathogens in pathogen
 * order, then swarm loads in swarm order. Each entry is a ready order plus where to draw it.
 */
export function supportTargets(
  battle: BattleState,
  orders: readonly Order[],
  charge: ChargeKind,
): { order: SupportOrder; at: Coord }[] {
  const candidates: { order: SupportOrder; at: Coord }[] = [
    ...battle.pathogens
      .filter((p) => !p.hidden)
      .map((p) => ({
        order: {
          type: "support" as const,
          charge,
          target: "pathogen" as const,
          pathogenId: p.id,
        },
        at: p.at,
      })),
    ...battle.swarms.map((s) => ({
      order: {
        type: "support" as const,
        charge,
        target: "load" as const,
        swarmId: s.id,
      },
      at: s.at,
    })),
  ];
  return candidates.filter(
    (c) => supportProblem(battle, orders, c.order) === null,
  );
}
