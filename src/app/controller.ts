import { sameCoord } from "../sim/board";
import { telegraph, type TelegraphMark } from "../sim/battle/intents";
import { moveOptions, orderProblems, withOrder } from "../sim/battle/orders";
import { resolveTurn } from "../sim/battle/resolve";
import type {
  BattleState,
  Coord,
  Order,
  SimEvent,
  SwarmId,
} from "../sim/types";

export interface OrderUi {
  readonly orders: readonly Order[];
  readonly selected: SwarmId | null;
}

const NONE: OrderUi = { orders: [], selected: null };

/** Tiles the selected swarm may be ordered to: legal moves that are not another swarm's tile. */
export function orderOptions(
  battle: BattleState,
  ui: OrderUi,
): readonly Coord[] {
  if (!ui.selected) return [];
  return moveOptions(battle, ui.selected, ui.orders)
    .map((r) => r.at)
    .filter((c) => !battle.swarms.some((s) => sameCoord(s.at, c)));
}

const swarmAt = (battle: BattleState, at: Coord) =>
  battle.swarms.find((s) => sameCoord(s.at, at));

/**
 * What a tap on a tile (null = off the board) does:
 * - own tile of the selected swarm: queue hold (cancels a move);
 * - an option tile: queue the move, or clear it if that move is already queued;
 * - another swarm: select it; anything else: deselect.
 */
export function tapTile(
  battle: BattleState,
  ui: OrderUi,
  at: Coord | null,
): OrderUi {
  if (!at) return { ...ui, selected: null };
  const here = swarmAt(battle, at);
  const sel = battle.swarms.find((s) => s.id === ui.selected);
  if (here && here.id === sel?.id) {
    return {
      ...ui,
      orders: withOrder(ui.orders, { type: "hold", swarmId: here.id }),
    };
  }
  if (here) return { ...ui, selected: here.id };
  if (sel && orderOptions(battle, ui).some((c) => sameCoord(c, at))) {
    const cur = ui.orders.find((o) => o.swarmId === sel.id);
    if (cur?.type === "move" && sameCoord(cur.to, at)) {
      return { ...ui, orders: clearOrder(ui.orders, sel.id) };
    }
    return {
      ...ui,
      orders: withOrder(ui.orders, { type: "move", swarmId: sel.id, to: at }),
    };
  }
  return { ...ui, selected: null };
}

export function clearOrder(
  orders: readonly Order[],
  swarmId: SwarmId,
): Order[] {
  return orders.filter((o) => o.swarmId !== swarmId);
}

/** Next swarm in id order (previous for dir -1); wraps, and starts from the ends when none. */
export function cycleSelection(
  battle: BattleState,
  selected: SwarmId | null,
  dir: 1 | -1 = 1,
): SwarmId | null {
  const ids = battle.swarms.map((s) => s.id).sort();
  if (ids.length === 0) return null;
  const i = selected ? ids.indexOf(selected) : -1;
  if (i < 0) return dir === 1 ? ids[0]! : ids[ids.length - 1]!;
  return ids[(i + dir + ids.length) % ids.length]!;
}

export function describeOrder(o: Order): string {
  switch (o.type) {
    case "move":
      return `${o.swarmId} -> ${xy(o.to)}`;
    case "hold":
      return `${o.swarmId} hold`;
    default:
      return `${o.swarmId} ${o.type}`;
  }
}

export interface PendingEntry {
  readonly swarmId: SwarmId;
  readonly text: string;
  readonly hasOrder: boolean;
  readonly selected: boolean;
}

export interface Controller {
  state(): BattleState;
  /** Events from the most recent resolve; empty after a reset. */
  lastEvents(): readonly SimEvent[];
  canEndTurn(): boolean;
  orders(): readonly Order[];
  selected(): SwarmId | null;
  /** Legal destinations for the selected swarm. */
  options(): readonly Coord[];
  /** Telegraph marks as they will resolve with the pending orders. */
  marks(): TelegraphMark[];
  /** Order list plus the selected swarm if it has no order yet. */
  pending(): PendingEntry[];
  /** Why the last End Turn was refused; cleared by any order change. */
  problems(): readonly string[];
  select(id: SwarmId | null): void;
  /** Tab: select the next (or previous) swarm. */
  cycle(dir?: 1 | -1): void;
  tap(at: Coord | null): void;
  clearOrder(id: SwarmId): void;
  /** Resolves with the pending orders and swaps in the new state (no playback yet). */
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
  let ui: OrderUi = NONE;
  let problems: readonly string[] = [];
  const set = (next: OrderUi) => {
    ui = next;
    problems = [];
    onChange(c);
  };
  const c: Controller = {
    state: () => state,
    lastEvents: () => events,
    canEndTurn: () => state.turn <= state.maxTurns,
    orders: () => ui.orders,
    selected: () => ui.selected,
    options: () => orderOptions(state, ui),
    marks: () => telegraph(state, ui.orders),
    pending() {
      const list = ui.orders.map((o) => ({
        swarmId: o.swarmId,
        text: describeOrder(o),
        hasOrder: true,
        selected: o.swarmId === ui.selected,
      }));
      if (ui.selected && !ui.orders.some((o) => o.swarmId === ui.selected)) {
        list.push({
          swarmId: ui.selected,
          text: `${ui.selected} (no order)`,
          hasOrder: false,
          selected: true,
        });
      }
      return list;
    },
    problems: () => problems,
    select: (id) => set({ ...ui, selected: id }),
    cycle: (dir = 1) =>
      set({ ...ui, selected: cycleSelection(state, ui.selected, dir) }),
    tap: (at) => set(tapTile(state, ui, at)),
    clearOrder: (id) => set({ ...ui, orders: clearOrder(ui.orders, id) }),
    endTurn() {
      if (!c.canEndTurn()) return;
      const found = orderProblems(state, ui.orders);
      if (found.length > 0) {
        problems = found;
        onChange(c);
        return;
      }
      const r = resolveTurn(state, ui.orders);
      state = r.state;
      events = r.events;
      ui = NONE;
      problems = [];
      onChange(c);
    },
    reset() {
      state = load();
      events = [];
      ui = NONE;
      problems = [];
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
