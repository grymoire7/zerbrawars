import type { TelegraphMark } from "../sim/battle/intents";
import { carriedKillChance, swarmMoveRange } from "../sim/battle/orders";
import { PARAMS } from "../sim/params";
import { organismName, organismSub } from "../sim/organisms";
import { pathogenKind } from "../sim/pathogens";
import { sameCoord } from "../sim/board";
import { arrivalCard, arrivalId, isDue } from "./arrivalModel";
import type { BattleState, Coord, Order, SwarmId } from "../sim/types";

export interface InfoRef {
  /** "arrival" ids are the incoming mark ids ("arrive:<index>"). */
  readonly kind: "pathogen" | "swarm" | "arrival";
  readonly id: string;
}

/** A short card for the side panel. */
export interface InfoCard {
  readonly title: string;
  readonly sub: string;
  readonly lines: readonly string[];
}

export type OrderStatus =
  "none" | "move" | "hold" | "engulf" | "wallOff" | "busy";

export interface SwarmStatus {
  readonly swarmId: SwarmId;
  readonly status: OrderStatus;
  /** Plain-language chip text. */
  readonly label: string;
  readonly selected: boolean;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  none: "no order",
  move: "move",
  hold: "hold",
  engulf: "engulf",
  wallOff: "wall off",
  busy: "busy",
};

const xy = (c: Coord) => `${c.x},${c.y}`;

/** The swarm, pathogen or incoming mark on a tile (in that order), or null. */
export function entityAt(battle: BattleState, at: Coord): InfoRef | null {
  const s = battle.swarms.find((w) => sameCoord(w.at, at));
  if (s) return { kind: "swarm", id: s.id };
  const p = battle.pathogens.find((q) => !q.hidden && sameCoord(q.at, at));
  if (p) return { kind: "pathogen", id: p.id };
  const i = battle.arrivals.findIndex(
    (a) => isDue(a, battle) && sameCoord(a.door, at),
  );
  return i >= 0 ? { kind: "arrival", id: arrivalId(i) } : null;
}

export function sameRef(a: InfoRef | null, b: InfoRef | null): boolean {
  return a === b || (!!a && !!b && a.kind === b.kind && a.id === b.id);
}

/** One status per swarm: what order it has, or "no order" (it will hold). */
export function swarmStatuses(
  battle: BattleState,
  orders: readonly Order[],
  selected: SwarmId | null,
): SwarmStatus[] {
  return battle.swarms.map((s) => {
    const o = orders.find((q) => q.swarmId === s.id);
    const status: OrderStatus = o ? o.type : s.busyTurns > 0 ? "busy" : "none";
    return {
      swarmId: s.id,
      status,
      label: STATUS_LABEL[status],
      selected: s.id === selected,
    };
  });
}

/** How many swarms have an order, and how many are ordered out of the total. */
export function orderCount(statuses: readonly SwarmStatus[]): {
  ordered: number;
  total: number;
  holding: number;
} {
  const ordered = statuses.filter(
    (s) => s.status !== "none" && s.status !== "busy",
  ).length;
  const holding = statuses.filter((s) => s.status === "none").length;
  return { ordered, total: statuses.length, holding };
}

/** The quiet hint beside End Turn, or "" when every swarm has an order. */
export function endTurnHint(holding: number): string {
  if (holding <= 0) return "";
  return `(${holding} ${holding === 1 ? "swarm" : "swarms"} will hold)`;
}

const nextTurn = (m: TelegraphMark | undefined, size: number): string => {
  if (!m) return "nothing planned";
  if (m.cancelledBy) return `nothing, ${m.cancelledBy} engulfs it first`;
  if (m.cancelledByCharge) {
    return `nothing, the ${m.cancelledByCharge} dose kills it first (its arrow disappears)`;
  }
  if (m.type === "stall") return "nothing, held back by medication";
  if (m.type === "grow" || !m.to) return `grow from ${size} to ${m.sizeAfter}`;
  const dest = xy(m.to);
  if (m.blockedBy) {
    const verb = m.type === "spore" ? "send a spore" : "spread";
    return `${verb} to ${dest}, but ${m.blockedBy} blocks it`;
  }
  return m.type === "spore"
    ? `send a spore to ${dest} (new size ${m.childSize})`
    : `spread to ${dest} (new size ${m.childSize})`;
};

/** The info card for a pathogen or swarm; null if it is gone. */
export function infoFor(
  battle: BattleState,
  marks: readonly TelegraphMark[],
  ref: InfoRef,
  orders: readonly Order[] = [],
): InfoCard | null {
  if (ref.kind === "arrival") {
    const mark = marks.find((m) => m.pathogenId === ref.id);
    return mark ? arrivalCard(battle, mark) : null;
  }
  if (ref.kind === "pathogen") {
    const p = battle.pathogens.find((q) => q.id === ref.id);
    if (!p || p.hidden) return null;
    const kind = pathogenKind(p.kind);
    const mark = marks.find((m) => m.pathogenId === p.id);
    return {
      title: `${organismName(p.kind)} ${p.id}`,
      sub: organismSub(p.kind),
      lines: [
        `Size ${p.size}`,
        mark?.type === "stall" && !mark.cancelledBy && !mark.cancelledByCharge
          ? "Held back by medication: it skips its action this turn."
          : `Next turn: ${nextTurn(mark, p.size)}.`,
        kind.wall === "leaky"
          ? "Engulfing it kills it."
          : "Sealed shell: engulfing it loads a swarm, but does not kill it.",
      ],
    };
  }
  const s = battle.swarms.find((w) => w.id === ref.id);
  if (!s) return null;
  const order = orders.find((o) => o.swarmId === s.id);
  const carried = s.load.map((c) => organismName(c.kind));
  const lines = [
    s.load.length > 0
      ? `Load ${s.load.length}/${PARAMS.loadCap}: ${carried.join(", ")}`
      : `Load 0/${PARAMS.loadCap}`,
    ...(s.load.length > 0
      ? [
          `Carrying ${carried.join(", ")}: ${Math.round(carriedKillChance(battle) * 100)}% this turn`,
        ]
      : []),
    `Moves up to ${swarmMoveRange(battle, s)} tiles`,
    order ? `Order: ${STATUS_LABEL[order.type]}` : "No order: it will hold",
  ];
  if (s.busyTurns > 0) lines.push(`Busy for ${s.busyTurns} more turn`);
  return { title: `Swarm ${s.id}`, sub: "Neutrophils", lines };
}

export interface HeatKey {
  /** Heat levels (1..3) present on the board right now. */
  readonly levels: readonly number[];
  /** Whether any tile is forecast to heat up. */
  readonly forecast: boolean;
}

/** Only the heat key items that matter on the current board. */
export function heatKey(battle: BattleState, rising: number): HeatKey {
  const present = new Set(battle.board.tiles.map((t) => t.inflammation));
  return {
    levels: [1, 2, 3].filter((l) => present.has(l)),
    forecast: rising > 0,
  };
}
