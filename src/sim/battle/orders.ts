import type { BattleState, Order } from "../types";

/** Order types resolveTurn can apply so far; the rest land with T4 (move), T5 (engulf), T7 (wallOff). */
const SUPPORTED: ReadonlySet<Order["type"]> = new Set(["hold"]);

/** Problems with a set of orders; an empty list means resolveTurn will accept them. */
export function orderProblems(
  battle: BattleState,
  orders: readonly Order[],
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const o of orders) {
    if (!battle.swarms.some((s) => s.id === o.swarmId)) {
      problems.push(`order for missing swarm ${o.swarmId}`);
    }
    if (seen.has(o.swarmId)) problems.push(`two orders for ${o.swarmId}`);
    seen.add(o.swarmId);
    if (!SUPPORTED.has(o.type)) {
      problems.push(`${o.type} orders are not supported yet`);
    }
  }
  return problems;
}
