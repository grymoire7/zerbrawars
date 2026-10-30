import {
  inBounds,
  reachableTiles,
  sameCoord,
  shortestPath,
  swarmBlockers,
  tileId,
  type Reach,
} from "../board";
import { PARAMS } from "../params";
import type {
  BattleState,
  Coord,
  Order,
  SimEvent,
  Swarm,
  SwarmId,
} from "../types";

/** Order types resolveTurn can apply so far; engulf lands with T5, wallOff with T7. */
const SUPPORTED: ReadonlySet<Order["type"]> = new Set(["hold", "move"]);

export interface OrderCheck {
  readonly order: Order;
  /** null = valid. */
  readonly reason: string | null;
  /** For a valid move: start to destination, both included. Otherwise null. */
  readonly path: readonly Coord[] | null;
}

/** Steps a swarm may move this turn. Load (T5) and inflammation (T7) will lower it here. */
export function moveRange(swarm: Swarm): number {
  return swarm.busyTurns > 0 ? 0 : PARAMS.swarmMoveRange;
}

const key = (c: Coord) => `${c.x},${c.y}`;

function moveProblem(
  battle: BattleState,
  swarm: Swarm,
  to: Coord,
  claimed: ReadonlyMap<string, SwarmId>,
): { reason: string | null; path: Coord[] | null } {
  const fail = (reason: string) => ({ reason, path: null });
  const { board } = battle;
  if (swarm.busyTurns > 0) return fail(`${swarm.id} is busy`);
  if (!inBounds(board, to)) return fail(`${key(to)} is off the board`);
  if (sameCoord(swarm.at, to)) return fail(`${swarm.id} is already there`);
  const blockers = swarmBlockers(battle, swarm.id);
  const target = tileId(board, to);
  if (blockers.blocked.has(target)) return fail(`${key(to)} is blocked`);
  const other = battle.swarms.find((s) => sameCoord(s.at, to));
  if (other) return fail(`${other.id} stands on ${key(to)}`);
  const claimer = claimed.get(key(to));
  if (claimer) return fail(`${claimer} is already moving to ${key(to)}`);
  const path = shortestPath(board, swarm.at, to, blockers);
  if (!path) return fail(`no path to ${key(to)}`);
  const range = moveRange(swarm);
  if (path.length - 1 > range) {
    return fail(`${key(to)} is ${path.length - 1} steps away, max ${range}`);
  }
  return { reason: null, path };
}

/**
 * Checks each order in list order and returns one result per order.
 * - One order per swarm: a later order for the same swarm is rejected.
 * - A move needs a free swarm and a legal path within moveRange. Pathogens and granulomas block;
 *   other swarms can be passed through.
 * - A move may not end on any swarm's current tile, even one that is moving away this turn. So
 *   swaps and follow-the-leader chains are illegal, every move is legal on its own, and
 *   cancelling one order never invalidates another.
 * - Two moves may not share a destination: the earlier valid one in the list keeps it.
 */
export function validateOrders(
  battle: BattleState,
  orders: readonly Order[],
): OrderCheck[] {
  const seen = new Set<SwarmId>();
  const claimed = new Map<string, SwarmId>();
  return orders.map((order): OrderCheck => {
    const fail = (reason: string): OrderCheck => ({
      order,
      reason,
      path: null,
    });
    const swarm = battle.swarms.find((s) => s.id === order.swarmId);
    if (!swarm) return fail(`no swarm ${order.swarmId}`);
    if (seen.has(swarm.id)) return fail(`two orders for ${swarm.id}`);
    seen.add(swarm.id);
    if (!SUPPORTED.has(order.type)) {
      return fail(`${order.type} orders are not supported yet`);
    }
    if (order.type !== "move") return { order, reason: null, path: null };
    const r = moveProblem(battle, swarm, order.to, claimed);
    if (r.reason === null) claimed.set(key(order.to), swarm.id);
    return { order, ...r };
  });
}

/** Reasons for every rejected order; an empty list means resolveTurn will accept them. */
export function orderProblems(
  battle: BattleState,
  orders: readonly Order[],
): string[] {
  return validateOrders(battle, orders).flatMap((c) =>
    c.reason === null ? [] : [c.reason],
  );
}

/** Replaces any existing order for the same swarm, keeping the list in swarm id order. */
export function withOrder(orders: readonly Order[], order: Order): Order[] {
  return [...orders.filter((o) => o.swarmId !== order.swarmId), order].sort(
    (a, b) => (a.swarmId < b.swarmId ? -1 : a.swarmId > b.swarmId ? 1 : 0),
  );
}

/**
 * Tiles the swarm may move to, row-major, given the other swarms' pending orders (their valid
 * destinations are excluded; this swarm's own pending order is ignored). Empty if busy or missing.
 */
export function moveOptions(
  battle: BattleState,
  swarmId: SwarmId,
  orders: readonly Order[] = [],
): Reach[] {
  const swarm = battle.swarms.find((s) => s.id === swarmId);
  if (!swarm) return [];
  const range = moveRange(swarm);
  if (range === 0) return [];
  const claimed = new Set(
    validateOrders(
      battle,
      orders.filter((o) => o.swarmId !== swarmId),
    ).flatMap((c) =>
      c.reason === null && c.order.type === "move" ? [key(c.order.to)] : [],
    ),
  );
  return reachableTiles(
    battle.board,
    swarm.at,
    range,
    swarmBlockers(battle, swarmId),
  ).filter((r) => !claimed.has(key(r.at)));
}

/** The path a move to `to` would take (start and end included), or null if it is not legal. */
export function movePath(
  battle: BattleState,
  swarmId: SwarmId,
  to: Coord,
): Coord[] | null {
  const swarm = battle.swarms.find((s) => s.id === swarmId);
  if (!swarm) return null;
  return moveProblem(battle, swarm, to, new Map()).path;
}

/**
 * Applies the valid moves among `orders` in swarm order and returns the new state and a
 * SwarmMoved event per move. Invalid orders are skipped: resolveTurn rejects them beforehand,
 * and the telegraph preview simply ignores them.
 */
export function applyMoves(
  battle: BattleState,
  orders: readonly Order[],
): { state: BattleState; events: SimEvent[] } {
  const paths = new Map<SwarmId, readonly Coord[]>();
  for (const c of validateOrders(battle, orders)) {
    if (c.path) paths.set(c.order.swarmId, c.path);
  }
  const events: SimEvent[] = [];
  const swarms = battle.swarms.map((s) => {
    const path = paths.get(s.id);
    if (!path) return s;
    events.push({ type: "SwarmMoved", swarmId: s.id, path });
    return { ...s, at: path[path.length - 1] };
  });
  return { state: { ...battle, swarms }, events };
}
