import { sameCoord, tileId } from "../board";
import { PARAMS } from "../params";
import type {
  BattleState,
  BattleStatus,
  Order,
  Pathogen,
  SimEvent,
  SwarmId,
} from "../types";
import {
  applyInflammation,
  inflammationChanges,
  tissueDamageFor,
  type TileHeat,
} from "./inflammation";
import { generateIntents, landingBlockers } from "./intents";
import { applyOrders, orderProblems, validateOrders } from "./orders";
import { battleStatus } from "./outcome";

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
 * Surviving pathogens run their telegraphed intents in telegraph (pathogen id) order.
 * - An intent whose pathogen is gone (engulfed) is cancelled; applyEngulfs also drops it.
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
  return { state: { ...battle, pathogens, intents: [], nextId }, events };
};

/** Player orders, pathogen intents, then the inflammation and damage tick. */
function runPhases(
  battle: BattleState,
  orders: readonly Order[],
): { state: BattleState; events: SimEvent[] } {
  const events: SimEvent[] = [];
  let state = battle;
  const phases: Phase[] = [
    (s) => applyOrders(s, orders),
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

/**
 * One turn, in the plan's order: player orders (moves, engulfs, wall-offs, carried-load kill rolls;
 * holds do nothing), pathogen intents, inflammation and damage, then turn + 1 and the next
 * telegraph (none once the battle is over). Throws, before changing anything, if the battle is
 * already over or validateOrders rejects any order; the error lists every reason.
 */
export function resolveTurn(
  battle: BattleState,
  orders: readonly Order[] = [],
): TurnResult {
  if (battleStatus(battle).over) throw new Error("the battle is over");
  const problems = orderProblems(battle, orders);
  if (problems.length > 0) {
    throw new Error(`invalid orders: ${problems.join("; ")}`);
  }
  const r = runPhases(battle, orders);
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
 * Where inflammation will rise or fall if the turn ends with `orders` (invalid ones ignored),
 * and what it costs. Uses the same phases as resolveTurn; inflammation never depends on a roll.
 */
export function inflammationPreview(
  battle: BattleState,
  orders: readonly Order[] = [],
): InflammationPreview {
  const valid = validateOrders(battle, orders).flatMap((c) =>
    c.reason === null ? [c.order] : [],
  );
  const moved = applyOrders(battle, valid).state;
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
