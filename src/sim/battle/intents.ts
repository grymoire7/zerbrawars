import {
  allCoords,
  compareCoords,
  distance,
  inBounds,
  neighbors,
  sameCoord,
  tileId,
} from "../board";
import { PARAMS } from "../params";
import { pathogenKind, type PathogenKindId } from "../pathogens";
import { rngInt, rngNext, type RngState } from "../rng";
import type {
  BattleState,
  ChargeKind,
  Coord,
  Intent,
  Order,
  Pathogen,
  PathogenId,
  SupportOrder,
  SwarmId,
  TileId,
} from "../types";
import { applyMoves, validEngulfs } from "./orders";
import { supportProblem } from "./support";

/**
 * Tiles a spread or spore may target right now: in bounds and holding no pathogen (hidden ones
 * included) or granuloma, and not the door of an arrival due this turn or the next (a spread landing there would block it). Swarm tiles stay legal; a
 * swarm there blocks the action at resolve.
 */
export function landingBlockers(battle: BattleState): Set<TileId> {
  const { board } = battle;
  return new Set([
    ...battle.pathogens.map((p) => tileId(board, p.at)),
    ...battle.granulomas.map((g) => tileId(board, g.at)),
    ...battle.arrivals
      .filter((a) => a.turn <= battle.turn + 1)
      .map((a) => tileId(board, a.door)),
  ]);
}

/** Candidate targets, row-major (spread: N, E, S, W) so a rolled index always means the same tile. */
function targetsFor(
  battle: BattleState,
  p: Pathogen,
  taken: ReadonlySet<TileId>,
): Coord[] {
  const { board } = battle;
  const free = (c: Coord) => inBounds(board, c) && !taken.has(tileId(board, c));
  if (!pathogenKind(p.kind).canSpore)
    return neighbors(board, p.at).filter(free);
  const { sporeMinDistance, sporeMaxDistance } = PARAMS.intents[p.kind];
  return allCoords(board)
    .filter((c) => {
      const d = distance(p.at, c);
      return d >= sporeMinDistance && d <= sporeMaxDistance && free(c);
    })
    .sort(compareCoords);
}

/** The chance a visible pathogen stalls each turn under `aura` (0..1). Always under 1. */
export function stallChance(aura: number): number {
  return Math.min(1, Math.max(0, aura)) * PARAMS.meds.auraStallChance;
}

/**
 * The stall roll comes first and is always made, so the same seed lines up across med levels: a
 * pathogen that stalls at a weaker aura also stalls at a stronger one on that roll.
 */
function rollIntent(
  battle: BattleState,
  p: Pathogen,
  taken: ReadonlySet<TileId>,
  rng: RngState,
): { intent: Intent | null; rng: RngState } {
  const stall = rngNext(rng);
  rng = stall.rng;
  if (stall.value < stallChance(battle.meds.aura)) {
    return { intent: { type: "stall", pathogenId: p.id }, rng };
  }
  const b = PARAMS.intents[p.kind];
  const canGrow = p.size < PARAMS.maxPathogenSize;
  const targets =
    p.size >= b.actMinSize && p.size - b.actCost >= 1
      ? targetsFor(battle, p, taken)
      : [];
  let act = targets.length > 0;
  if (act && canGrow) {
    const roll = rngNext(rng);
    rng = roll.rng;
    act = roll.value < b.actChance;
  }
  if (act) {
    const pick = rngInt(rng, targets.length);
    return {
      intent: {
        type: pathogenKind(p.kind).canSpore ? "spore" : "spread",
        pathogenId: p.id,
        to: targets[pick.value],
        size: b.childSize,
        cost: b.actCost,
      },
      rng: pick.rng,
    };
  }
  if (!canGrow) return { intent: null, rng };
  return {
    intent: {
      type: "grow",
      pathogenId: p.id,
      amount: Math.min(b.growAmount, PARAMS.maxPathogenSize - p.size),
    },
    rng,
  };
}

/**
 * Rolls the telegraph for the coming resolve from `rng.intents` only: at most one intent per
 * visible pathogen, in pathogen (id) order. Under the med aura a pathogen may stall instead. Each new target is taken, so no two intents share a
 * tile. A pathogen at max size with nowhere to go gets no intent.
 */
export function generateIntents(battle: BattleState): BattleState {
  const taken = landingBlockers(battle);
  const intents: Intent[] = [];
  let rng = battle.rng.intents;
  for (const p of battle.pathogens) {
    if (p.hidden) continue;
    const r = rollIntent(battle, p, taken, rng);
    rng = r.rng;
    if (!r.intent) continue;
    intents.push(r.intent);
    if (r.intent.type === "spread" || r.intent.type === "spore")
      taken.add(tileId(battle.board, r.intent.to));
  }
  return { ...battle, intents, rng: { ...battle.rng, intents: rng } };
}

/** Fills the first telegraph of a freshly set-up battle. */
export function initBattle(battle: BattleState): BattleState {
  return generateIntents(battle);
}

/**
 * What the telegraph draws for one pathogen, or for an arrival due this turn (type "arrive":
 * `from` and `to` are both its door, `pathogenId` is "arrive:<index>" and `kind` is set).
 */
export interface TelegraphMark {
  readonly pathogenId: PathogenId;
  readonly type: Intent["type"] | "arrive";
  /** Set on arrive marks only. */
  readonly kind?: PathogenKindId;
  readonly from: Coord;
  /** Target tile for spread/spore, null for grow and stall. */
  readonly to: Coord | null;
  /** The pathogen's size after the intent lands. */
  readonly sizeAfter: number;
  /** Size of the new pathogen for spread/spore, 0 for grow and stall. */
  readonly childSize: number;
  /** The swarm that will stand on the target once `orders` move, which blocks it. */
  readonly blockedBy: SwarmId | null;
  /**
   * The swarm whose pending engulf removes this pathogen first, so the intent will not happen.
   * The other fields still describe the intent as telegraphed.
   */
  readonly cancelledBy: SwarmId | null;
  /** The charge whose pending support kills this pathogen first, so the intent will not happen. */
  readonly cancelledByCharge: ChargeKind | null;
}

/**
 * The marks to draw, as they will resolve if the turn ends with `orders` and `support`. Uses the
 * same move, engulf and support validation as resolveTurn, so a preview block or cancel is real.
 * Invalid orders are ignored here. The one gap: a move that will be cut short by a hidden token is
 * previewed in full, since showing the stop would reveal the token.
 */
export function telegraph(
  current: BattleState,
  orders: readonly Order[] = [],
  support: SupportOrder | null = null,
): TelegraphMark[] {
  const battle = applyMoves(current, orders, false).state;
  const engulfedBy = new Map(
    validEngulfs(current, orders).map((e) => [e.pathogen.id, e.order.swarmId]),
  );
  const charged =
    support?.target === "pathogen" &&
    supportProblem(current, orders, support) === null
      ? support
      : null;
  const arrivals = battle.arrivals.flatMap((a, index): TelegraphMark[] => {
    if (a.turn > battle.turn) return [];
    const swarm = battle.swarms.find((s) => sameCoord(s.at, a.door));
    return [
      {
        pathogenId: `arrive:${index}`,
        type: "arrive",
        kind: a.kind,
        from: a.door,
        to: a.door,
        sizeAfter: a.size,
        childSize: a.size,
        blockedBy: swarm?.id ?? null,
        cancelledBy: null,
        cancelledByCharge: null,
      },
    ];
  });
  const marks = battle.intents.flatMap((i): TelegraphMark[] => {
    const p = battle.pathogens.find((q) => q.id === i.pathogenId);
    if (!p) return [];
    const cancelledBy = engulfedBy.get(p.id) ?? null;
    const cancelledByCharge =
      charged?.pathogenId === p.id ? charged.charge : null;
    if (i.type === "grow" || i.type === "stall") {
      return [
        {
          pathogenId: p.id,
          type: i.type,
          from: p.at,
          to: null,
          sizeAfter: p.size + (i.type === "grow" ? i.amount : 0),
          childSize: 0,
          blockedBy: null,
          cancelledBy,
          cancelledByCharge,
        },
      ];
    }
    const swarm = battle.swarms.find((s) => sameCoord(s.at, i.to));
    return [
      {
        pathogenId: p.id,
        type: i.type,
        from: p.at,
        to: i.to,
        sizeAfter: swarm ? p.size : p.size - i.cost,
        childSize: i.size,
        blockedBy: swarm?.id ?? null,
        cancelledBy,
        cancelledByCharge,
      },
    ];
  });
  return [...marks, ...arrivals];
}
