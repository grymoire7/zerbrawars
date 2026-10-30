import { resolveTurn } from "../sim/battle/resolve";
import type { BattleState, Coord, SimEvent } from "../sim/types";

export interface Controller {
  state(): BattleState;
  /** Events from the most recent resolve; empty after a reset. */
  lastEvents(): readonly SimEvent[];
  canEndTurn(): boolean;
  /** Resolves with no orders and swaps in the new state (no playback yet). */
  endTurn(): void;
  /** Reloads the scenario with the same seed. */
  reset(): void;
}

export function createController(
  load: () => BattleState,
  onChange: (c: Controller) => void,
): Controller {
  let state = load();
  let events: readonly SimEvent[] = [];
  const c: Controller = {
    state: () => state,
    lastEvents: () => events,
    canEndTurn: () => state.turn <= state.maxTurns,
    endTurn() {
      if (!c.canEndTurn()) return;
      const r = resolveTurn(state, []);
      state = r.state;
      events = r.events;
      onChange(c);
    },
    reset() {
      state = load();
      events = [];
      onChange(c);
    },
  };
  return c;
}

const xy = (c: Coord) => `${c.x},${c.y}`;

export function describeEvent(e: SimEvent): string {
  switch (e.type) {
    case "Grew":
      return `${e.pathogenId} grew to ${e.size}`;
    case "Spread":
      return `${e.pathogenId} spread to ${xy(e.to)} (${e.newPathogenId})`;
    case "Spored":
      return `${e.pathogenId} spored to ${xy(e.to)} (${e.newPathogenId})`;
    case "Blocked":
      return `${e.pathogenId} ${e.intent} blocked at ${xy(e.at)} by ${e.swarmId}`;
    case "TissueDamaged":
      return `tissue -${e.amount} (${e.tissueHealth})`;
    default:
      return e.type;
  }
}
