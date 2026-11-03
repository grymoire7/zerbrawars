import { distance, sameCoord, tileId } from "../board";
import { PARAMS } from "../params";
import { wallOf } from "../pathogens";
import type {
  Arrival,
  BattleState,
  Coord,
  BattleStatus,
  Order,
  Pathogen,
  SimEvent,
  SupportOrder,
  SwarmId,
} from "../types";
import {
  applyInflammation,
  inflammationChanges,
  tissueDamageFor,
  type TileHeat,
} from "./inflammation";
import { generateIntents, landingBlockers } from "./intents";
import {
  applyCarriedKills,
  applyEngulfs,
  applyMoves,
  applyWallOffs,
  orderProblems,
  validateOrders,
} from "./orders";
import { battleStatus } from "./outcome";
import { applySupport, supportProblem, withoutClearedLoad } from "./support";

export interface TurnResult {
  readonly state: BattleState;
  readonly events: SimEvent[];
  /** battleStatus of the new state: once over, grade it with gradeOutcome. */
  readonly status: BattleStatus;
}

type Phase = (battle: BattleState) => {
  state: BattleState;
  events: SimEvent[];
};

/**
 * Moves (engulf `from` moves included, revealing hidden tokens unless `reveal` is false), the
 * support charge, engulfs, wall-offs, then carried-load kill rolls. Invalid orders are skipped.
 */
export function applyOrders(
  battle: BattleState,
  orders: readonly Order[],
  support: SupportOrder | null = null,
  reveal = true,
): { state: BattleState; events: SimEvent[] } {
  const moved = applyMoves(battle, orders, reveal);
  const supported = applySupport(battle, moved.state, orders, support);
  const engulfed = applyEngulfs(battle, supported.state, orders);
  const walled = applyWallOffs(battle, engulfed.state, orders);
  const carried = applyCarriedKills(
    withoutClearedLoad(battle, support),
    walled.state,
  );
  return {
    state: carried.state,
    events: [
      ...moved.events,
      ...supported.events,
      ...engulfed.events,
      ...walled.events,
      ...carried.events,
    ],
  };
}

/**
 * Surviving pathogens run their telegraphed intents in telegraph (pathogen id) order.
 * - An intent whose pathogen is gone (engulfed or charged) is cancelled; both also drop it.
 * - A stall does nothing and emits nothing.
 * - A spread or spore onto a swarm emits Blocked; the parent pays no cost.
 * - A target holding a pathogen or granuloma does nothing and emits nothing. The first intent
 *   in order wins a shared tile; generateIntents never produces one, so this is a safety net.
 */
const runIntents: Phase = (battle) => {
  const { board } = battle;
  const events: SimEvent[] = [];
  const pathogens: Pathogen[] = [...battle.pathogens];
  const occupied = landingBlockers(battle);
  let nextId = battle.nextId;

  for (const intent of battle.intents) {
    const index = pathogens.findIndex((p) => p.id === intent.pathogenId);
    if (index < 0) continue;
    const p = pathogens[index];

    if (intent.type === "stall") continue;
    if (intent.type === "grow") {
      const size = Math.min(PARAMS.maxPathogenSize, p.size + intent.amount);
      if (size === p.size) continue;
      pathogens[index] = { ...p, size };
      events.push({ type: "Grew", pathogenId: p.id, size });
      continue;
    }

    const swarm = battle.swarms.find((s) => sameCoord(s.at, intent.to));
    if (swarm) {
      events.push({
        type: "Blocked",
        pathogenId: p.id,
        intent: intent.type,
        at: intent.to,
        swarmId: swarm.id,
      });
      continue;
    }
    const target = tileId(board, intent.to);
    if (occupied.has(target)) continue;
    occupied.add(target);

    const newPathogenId = `p${nextId++}`;
    const parentSize = Math.max(1, p.size - intent.cost);
    const size = Math.min(PARAMS.maxPathogenSize, intent.size);
    pathogens[index] = { ...p, size: parentSize };
    pathogens.push({
      id: newPathogenId,
      kind: p.kind,
      size,
      at: intent.to,
      hidden: false,
    });
    events.push({
      type: intent.type === "spread" ? "Spread" : "Spored",
      pathogenId: p.id,
      newPathogenId,
      from: p.at,
      to: intent.to,
      size,
      parentSize,
    });
  }
  const landed = runArrivals(battle, pathogens, nextId, events);
  return {
    state: {
      ...battle,
      pathogens: landed.pathogens,
      arrivals: landed.arrivals,
      intents: [],
      nextId: landed.nextId,
    },
    events,
  };
};

/**
 * The nearest door of PARAMS.setup.doors (ties in list order) with nobody on it and no arrival
 * already headed there on `turn`; `from` itself if every door is taken.
 */
function freeDoor(
  battle: BattleState,
  pathogens: readonly Pathogen[],
  pending: readonly Arrival[],
  from: Coord,
  turn: number,
): Coord {
  const taken = (c: Coord) =>
    battle.swarms.some((s) => sameCoord(s.at, c)) ||
    pathogens.some((p) => sameCoord(p.at, c)) ||
    battle.granulomas.some((g) => sameCoord(g.at, c)) ||
    pending.some((a) => a.turn === turn && sameCoord(a.door, c));
  const free = PARAMS.setup.doors.filter((d) => !taken(d));
  return (
    [...free].sort((a, b) => distance(from, a) - distance(from, b))[0] ?? from
  );
}

/**
 * Lands the arrivals due this turn, after the pathogens' intents (a spread never targets a due
 * door). A swarm on the door blocks the group: leaky dies, sealed (or any group whose door holds a
 * pathogen or granuloma) tries again next turn at the nearest free door.
 */
function runArrivals(
  battle: BattleState,
  pathogens: Pathogen[],
  nextId: number,
  events: SimEvent[],
): { pathogens: Pathogen[]; arrivals: Arrival[]; nextId: number } {
  const arrivals: Arrival[] = [];
  const due = battle.arrivals.filter((a) => a.turn <= battle.turn);
  const later = battle.arrivals.filter((a) => a.turn > battle.turn);
  const retries: Arrival[] = [];
  for (const a of due) {
    const swarm = battle.swarms.find((s) => sameCoord(s.at, a.door));
    const busy =
      pathogens.some((p) => sameCoord(p.at, a.door)) ||
      battle.granulomas.some((g) => sameCoord(g.at, a.door));
    if (!swarm && !busy) {
      const id = `p${nextId++}`;
      pathogens.push({
        id,
        kind: a.kind,
        size: a.size,
        at: a.door,
        hidden: false,
      });
      events.push({
        type: "Arrived",
        pathogenId: id,
        kind: a.kind,
        size: a.size,
        ...(battle.missedDoses ? { bonus: battle.missedDoses } : {}),
        at: a.door,
      });
      continue;
    }
    const dies = swarm !== undefined && wallOf(a) === "leaky";
    events.push({
      type: "ArrivalBlocked",
      kind: a.kind,
      size: a.size,
      at: a.door,
      swarmId: swarm?.id ?? null,
      fate: dies ? "died" : "delayed",
    });
    if (!dies) {
      const turn = battle.turn + 1;
      retries.push({
        ...a,
        turn,
        door: freeDoor(battle, pathogens, [...later, ...retries], a.door, turn),
      });
    }
  }
  arrivals.push(...later, ...retries);
  arrivals.sort((x, y) => x.turn - y.turn);
  return { pathogens, arrivals, nextId };
}

/** Player orders, pathogen intents, then the inflammation and damage tick. */
function runPhases(
  battle: BattleState,
  orders: readonly Order[],
  support: SupportOrder | null,
): { state: BattleState; events: SimEvent[] } {
  const events: SimEvent[] = [];
  let state = battle;
  const phases: Phase[] = [
    (s) => applyOrders(s, orders, support),
    runIntents,
    (s) => applyInflammation(s, battle),
  ];
  for (const phase of phases) {
    const r = phase(state);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

/** Every reason resolveTurn would reject these orders and support for; empty means accepted. */
export function turnProblems(
  battle: BattleState,
  orders: readonly Order[],
  support: SupportOrder | null = null,
): string[] {
  const problems = orderProblems(battle, orders);
  const s = support && supportProblem(battle, orders, support);
  return s ? [...problems, s] : problems;
}

/**
 * One turn, in the plan's order: player orders (moves, the support charge, engulfs, wall-offs,
 * carried-load kill rolls; holds do nothing), pathogen intents, inflammation and damage, then
 * turn + 1 and the next telegraph (none once the battle is over). Throws, before changing
 * anything, if the battle is already over or any order or the support is invalid; the error
 * lists every reason.
 */
export function resolveTurn(
  battle: BattleState,
  orders: readonly Order[] = [],
  support: SupportOrder | null = null,
): TurnResult {
  if (battleStatus(battle).over) throw new Error("the battle is over");
  const problems = turnProblems(battle, orders, support);
  if (problems.length > 0) {
    throw new Error(`invalid orders: ${problems.join("; ")}`);
  }
  const r = runPhases(battle, orders, support);
  const next = { ...r.state, turn: r.state.turn + 1 };
  const status = battleStatus(next);
  const state = status.over ? next : generateIntents(next);
  return { state, events: r.events, status };
}

export interface InflammationPreview {
  /** Tiles that will heat up this turn, row-major. */
  readonly rising: readonly TileHeat[];
  /** Tiles that will cool down, row-major. */
  readonly falling: readonly TileHeat[];
  /** Tissue health the tick will cost. */
  readonly tissueDamage: number;
  /**
   * Swarms that will start next turn on a tile at the slow threshold (they lose
   * `inflammationMovePenalty` moves unless already at the minimum range).
   */
  readonly slowed: readonly SwarmId[];
}

/**
 * Where inflammation will rise or fall if the turn ends with `orders` and `support` (invalid ones
 * ignored), and what it costs. Uses the same phases as resolveTurn, except that hidden tokens are
 * not revealed (so the preview never leaks one); inflammation never depends on a roll.
 */
export function inflammationPreview(
  battle: BattleState,
  orders: readonly Order[] = [],
  support: SupportOrder | null = null,
): InflammationPreview {
  const valid = validateOrders(battle, orders).flatMap((c) =>
    c.reason === null ? [c.order] : [],
  );
  const moved = applyOrders(battle, valid, support, false).state;
  const before = runIntents(moved).state;
  const changes = inflammationChanges(before, battle);
  const tiles = [...before.board.tiles];
  for (const c of changes) {
    tiles[tileId(before.board, c.at)] = { inflammation: c.after };
  }
  const slowThreshold = PARAMS.inflammation.slowThreshold;
  return {
    rising: changes.filter((c) => c.after > c.before),
    falling: changes.filter((c) => c.after < c.before),
    tissueDamage: Math.min(battle.tissueHealth, tissueDamageFor(tiles)),
    slowed: before.swarms
      .filter(
        (s) => tiles[tileId(before.board, s.at)].inflammation >= slowThreshold,
      )
      .map((s) => s.id),
  };
}
