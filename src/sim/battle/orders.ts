import {
  compareCoords,
  inBounds,
  isAdjacent,
  reachableTiles,
  sameCoord,
  shortestPath,
  swarmBlockers,
  tileId,
  type Reach,
} from "../board";
import { PARAMS } from "../params";
import { wallOf, type Wall } from "../pathogens";
import { rngNext } from "../rng";
import type {
  BattleState,
  Contained,
  Coord,
  Order,
  Pathogen,
  PathogenId,
  SimEvent,
  Swarm,
  SwarmId,
} from "../types";

/** Order types resolveTurn can apply so far; wallOff lands with T7. */
const SUPPORTED: ReadonlySet<Order["type"]> = new Set([
  "hold",
  "move",
  "engulf",
]);

type EngulfOrder = Extract<Order, { type: "engulf" }>;

export interface OrderCheck {
  readonly order: Order;
  /** null = valid. */
  readonly reason: string | null;
  /** For a valid move, or a valid engulf with a `from` move: start to destination. Otherwise null. */
  readonly path: readonly Coord[] | null;
}

/**
 * Steps a swarm may move this turn: 0 while busy, otherwise the base range less
 * `loadedMovePenalty` per contained pathogen, never below `minLoadedMoveRange`.
 * Inflammation (T7) will lower it here too.
 */
export function moveRange(swarm: Pick<Swarm, "busyTurns" | "load">): number {
  if (swarm.busyTurns > 0) return 0;
  const range =
    PARAMS.swarmMoveRange - swarm.load.length * PARAMS.loadedMovePenalty;
  return Math.max(PARAMS.minLoadedMoveRange, range);
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
 * A sealed engulf needs a free load slot; a leaky one kills outright, so a full swarm may still
 * take it. Null when allowed.
 */
function capProblem(swarm: Swarm, p: Pathogen): string | null {
  return wallOf(p) === "sealed" && swarm.load.length >= PARAMS.loadCap
    ? `${swarm.id} is full (${swarm.load.length}/${PARAMS.loadCap})`
    : null;
}

function engulfProblem(
  battle: BattleState,
  swarm: Swarm,
  order: EngulfOrder,
  claimed: ReadonlyMap<string, SwarmId>,
  targeted: ReadonlyMap<PathogenId, SwarmId>,
): { reason: string | null; path: Coord[] | null } {
  const fail = (reason: string) => ({ reason, path: null });
  if (swarm.busyTurns > 0) return fail(`${swarm.id} is busy`);
  // Hidden and missing read the same, so a rejection never leaks a hidden token.
  const p = battle.pathogens.find((q) => q.id === order.pathogenId);
  if (!p || p.hidden) return fail(`no pathogen ${order.pathogenId}`);
  const taker = targeted.get(p.id);
  if (taker) return fail(`${taker} is already engulfing ${p.id}`);
  const full = capProblem(swarm, p);
  if (full) return fail(full);
  let path: Coord[] | null = null;
  if (order.from && !sameCoord(order.from, swarm.at)) {
    const r = moveProblem(battle, swarm, order.from, claimed);
    if (r.reason !== null) return r;
    path = r.path;
  }
  const end = order.from ?? swarm.at;
  if (!isAdjacent(end, p.at)) {
    return fail(`${p.id} is not next to ${key(end)}`);
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
 * - Two moves may not share a destination: the earlier valid one in the list keeps it. An
 *   engulf's `from` tile counts as a destination.
 * - An engulf needs a free swarm, a visible pathogen edge-adjacent to the tile it ends on (after
 *   its optional `from` move), no earlier engulf on the same pathogen, and a free load slot if the
 *   pathogen is sealed.
 */
export function validateOrders(
  battle: BattleState,
  orders: readonly Order[],
): OrderCheck[] {
  const seen = new Set<SwarmId>();
  const claimed = new Map<string, SwarmId>();
  const targeted = new Map<PathogenId, SwarmId>();
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
    if (order.type === "engulf") {
      const r = engulfProblem(battle, swarm, order, claimed, targeted);
      if (r.reason === null) {
        targeted.set(order.pathogenId, swarm.id);
        if (r.path) claimed.set(key(r.path[r.path.length - 1]), swarm.id);
      }
      return { order, ...r };
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
      c.reason === null && c.path ? [key(c.path[c.path.length - 1])] : [],
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
 * Applies the valid moves among `orders` (engulf `from` moves included) in swarm order and returns
 * the new state and a SwarmMoved event per move. Invalid orders are skipped: resolveTurn rejects them beforehand,
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

/** Valid engulf orders among `orders`, in swarm (list) order, with each target pathogen. */
export function validEngulfs(
  battle: BattleState,
  orders: readonly Order[],
): { order: EngulfOrder; pathogen: Pathogen }[] {
  return validateOrders(battle, orders).flatMap((c) => {
    if (c.reason !== null || c.order.type !== "engulf") return [];
    const order = c.order;
    const pathogen = battle.pathogens.find((p) => p.id === order.pathogenId);
    return pathogen ? [{ order, pathogen }] : [];
  });
}

const bySwarm = (a: { order: Order }, b: { order: Order }) =>
  a.order.swarmId < b.order.swarmId
    ? -1
    : a.order.swarmId > b.order.swarmId
      ? 1
      : 0;

/**
 * Applies the valid engulfs among `orders` in swarm order. Run on the state after moves, with the
 * pre-move state's checks (`before`), so validity is the same one the player saw.
 * - Leaky: Engulfed, Killed. The whole pathogen dies whatever its size.
 * - Sealed: Engulfed, then one roll on `rng.resolution` against residualKillChance (always made,
 *   so the stream advances the same way whatever the chance): ResidualKill, then Killed on a
 *   success or Loaded on a failure. The pathogen leaves the board either way, so its intent is
 *   cancelled.
 */
export function applyEngulfs(
  before: BattleState,
  after: BattleState,
  orders: readonly Order[],
): { state: BattleState; events: SimEvent[] } {
  const engulfs = validEngulfs(before, orders).sort(bySwarm);
  if (engulfs.length === 0) return { state: after, events: [] };
  const events: SimEvent[] = [];
  const gone = new Set<PathogenId>();
  const loads = new Map<SwarmId, readonly Contained[]>();
  let rng = after.rng.resolution;
  for (const { order, pathogen: p } of engulfs) {
    const wall = wallOf(p);
    events.push({
      type: "Engulfed",
      swarmId: order.swarmId,
      pathogenId: p.id,
      wall,
    });
    gone.add(p.id);
    let killed = wall === "leaky";
    if (!killed) {
      const roll = rngNext(rng);
      rng = roll.rng;
      killed = roll.value < after.residualKillChance;
      events.push({
        type: "ResidualKill",
        swarmId: order.swarmId,
        chance: after.residualKillChance,
        success: killed,
      });
    }
    if (killed) {
      events.push({
        type: "Killed",
        pathogenId: p.id,
        at: p.at,
        cause: "engulf",
      });
      continue;
    }
    const swarm = after.swarms.find((s) => s.id === order.swarmId) as Swarm;
    const load = [...swarm.load, { kind: p.kind, size: p.size }];
    loads.set(swarm.id, load);
    events.push({ type: "Loaded", swarmId: swarm.id, load });
  }
  return {
    state: {
      ...after,
      swarms: after.swarms.map((s) => {
        const load = loads.get(s.id);
        return load ? { ...s, load } : s;
      }),
      pathogens: after.pathogens.filter((p) => !gone.has(p.id)),
      intents: after.intents.filter((i) => !gone.has(i.pathogenId)),
      rng: { ...after.rng, resolution: rng },
    },
    events,
  };
}

/** Moves (engulf `from` moves included), then engulfs. */
export function applyOrders(
  battle: BattleState,
  orders: readonly Order[],
): { state: BattleState; events: SimEvent[] } {
  const moved = applyMoves(battle, orders);
  const engulfed = applyEngulfs(battle, moved.state, orders);
  return {
    state: engulfed.state,
    events: [...moved.events, ...engulfed.events],
  };
}

/**
 * What an engulf will do: "kills" (leaky, or a sealed one at 100% residual), "loads" (sealed at
 * 0%), or "residualRoll" (sealed, kills with `killChance`, otherwise loads).
 */
export type EngulfOutcome = "kills" | "loads" | "residualRoll";

export interface EngulfPreview {
  /** null = valid. When set, the other fields still describe the would-be result. */
  readonly reason: string | null;
  readonly pathogenId: PathogenId;
  readonly wall: Wall;
  readonly outcome: EngulfOutcome;
  /** Chance the pathogen dies: 1 for leaky, residualKillChance for sealed. */
  readonly killChance: number;
  /** The `from` move's path, or null when engulfing in place. */
  readonly path: readonly Coord[] | null;
  /** The swarm's load and next-turn move range if the pathogen is loaded (unchanged if it dies). */
  readonly loadIfLoaded: readonly Contained[];
  readonly moveRangeIfLoaded: number;
  /** The same if it dies. */
  readonly moveRangeIfKilled: number;
}

export function engulfOutcome(
  wall: Wall,
  residualKillChance: number,
): EngulfOutcome {
  if (wall === "leaky" || residualKillChance >= 1) return "kills";
  return residualKillChance <= 0 ? "loads" : "residualRoll";
}

/**
 * Previews `order` as if added to the pending `orders` (replacing this swarm's own order, and
 * checked after the others, so a target or tile another swarm already holds is reported).
 * Returns null only if the swarm or pathogen does not exist or is hidden.
 */
export function engulfPreview(
  battle: BattleState,
  orders: readonly Order[],
  order: EngulfOrder,
): EngulfPreview | null {
  const swarm = battle.swarms.find((s) => s.id === order.swarmId);
  const p = battle.pathogens.find((q) => q.id === order.pathogenId);
  if (!swarm || !p || p.hidden) return null;
  const checks = validateOrders(battle, [
    ...orders.filter((o) => o.swarmId !== order.swarmId),
    order,
  ]);
  const check = checks[checks.length - 1];
  const wall = wallOf(p);
  const loadIfLoaded =
    wall === "sealed"
      ? [...swarm.load, { kind: p.kind, size: p.size }]
      : swarm.load;
  const free = { busyTurns: 0, load: swarm.load };
  return {
    reason: check.reason,
    pathogenId: p.id,
    wall,
    outcome: engulfOutcome(wall, battle.residualKillChance),
    killChance: wall === "leaky" ? 1 : battle.residualKillChance,
    path: check.path,
    loadIfLoaded,
    moveRangeIfLoaded: moveRange({ ...free, load: loadIfLoaded }),
    moveRangeIfKilled: moveRange(free),
  };
}

export interface EngulfTarget {
  readonly pathogenId: PathogenId;
  readonly wall: Wall;
  readonly outcome: EngulfOutcome;
  /** The tile to use as `from`: null if already adjacent, else the nearest legal approach tile. */
  readonly from: Coord | null;
  /** Every legal approach tile (null = in place first), nearest first, then row-major. */
  readonly froms: readonly (Coord | null)[];
}

/**
 * Pathogens the swarm can legally engulf this turn given the other swarms' pending orders, in
 * pathogen order, each with the `from` tile to use. Empty if the swarm is busy or missing.
 */
export function engulfTargets(
  battle: BattleState,
  swarmId: SwarmId,
  orders: readonly Order[] = [],
): EngulfTarget[] {
  const swarm = battle.swarms.find((s) => s.id === swarmId);
  if (!swarm || swarm.busyTurns > 0) return [];
  const others = orders.filter((o) => o.swarmId !== swarmId);
  const taken = new Set(validEngulfs(battle, others).map((e) => e.pathogen.id));
  const approaches: { at: Coord | null; steps: number }[] = [
    { at: null, steps: 0 },
    ...moveOptions(battle, swarmId, orders)
      .map((r) => ({ at: r.at as Coord | null, steps: r.steps }))
      .sort(
        (a, b) =>
          a.steps - b.steps || compareCoords(a.at as Coord, b.at as Coord),
      ),
  ];
  return battle.pathogens.flatMap((p): EngulfTarget[] => {
    if (p.hidden || taken.has(p.id) || capProblem(swarm, p)) return [];
    const froms = approaches
      .filter((a) => isAdjacent(a.at ?? swarm.at, p.at))
      .map((a) => a.at);
    if (froms.length === 0) return [];
    const wall = wallOf(p);
    return [
      {
        pathogenId: p.id,
        wall,
        outcome: engulfOutcome(wall, battle.residualKillChance),
        from: froms[0],
        froms,
      },
    ];
  });
}
