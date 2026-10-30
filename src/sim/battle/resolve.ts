import { sameCoord, tileId } from "../board";
import { PARAMS } from "../params";
import type { BattleState, Order, Pathogen, SimEvent } from "../types";
import { generateIntents, landingBlockers } from "./intents";
import { applyMoves, orderProblems } from "./orders";

export interface TurnResult {
  readonly state: BattleState;
  readonly events: SimEvent[];
}

/**
 * Player orders: moves, then engulfs (T5), then wall-offs (T7). Holds do nothing. Moves resolve
 * before intents, so a swarm that moves onto a telegraphed target blocks it.
 */
function applyOrders(
  battle: BattleState,
  orders: readonly Order[],
): TurnResult {
  return applyMoves(battle, orders);
}

/**
 * Surviving pathogens run their telegraphed intents in telegraph (pathogen id) order.
 * - An intent whose pathogen is gone (engulfed) is cancelled.
 * - A spread or spore onto a swarm emits Blocked; the parent pays no cost.
 * - A target holding a pathogen or granuloma does nothing and emits nothing. The first intent
 *   in order wins a shared tile; generateIntents never produces one, so this is a safety net.
 */
function runIntents(battle: BattleState): TurnResult {
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
}

/** Inflammation and tissue damage (T7). Nothing raises inflammation yet. */
function tick(battle: BattleState): TurnResult {
  return { state: battle, events: [] };
}

/**
 * One turn, in the plan's order: player orders, pathogen intents, inflammation and damage, then
 * the next telegraph and turn + 1. Throws, before changing anything, if validateOrders rejects any
 * order; the error lists every reason.
 */
export function resolveTurn(
  battle: BattleState,
  orders: readonly Order[] = [],
): TurnResult {
  const problems = orderProblems(battle, orders);
  if (problems.length > 0) {
    throw new Error(`invalid orders: ${problems.join("; ")}`);
  }
  const events: SimEvent[] = [];
  let state = battle;
  for (const phase of [
    (s: BattleState) => applyOrders(s, orders),
    runIntents,
    tick,
  ]) {
    const r = phase(state);
    state = r.state;
    events.push(...r.events);
  }
  state = generateIntents({ ...state, turn: state.turn + 1 });
  return { state, events };
}
