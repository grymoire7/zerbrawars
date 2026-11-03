import type { TelegraphMark } from "../sim/battle/intents";
import {
  PATHOGEN_KINDS,
  pathogenKind,
  type PathogenKindId,
} from "../sim/pathogens";
import type { Arrival, BattleState, Coord } from "../sim/types";

// Pure view-model text for the incoming-germ UI (battle-depth slice 4): the HUD's "Next:" line,
// the mark on the board and the info card. No blame: infections happen either way.

/** Short names for tight spots (the stats row, the board badge). */
export const SHORT_NAME: Record<PathogenKindId, string> = {
  strep: "Strep",
  staph: "Staph",
  aspergillus: "Mold",
};

const xy = (c: Coord) => `${c.x},${c.y}`;

/** Marks of type arrive are named "arrive:<index into BattleState.arrivals>". */
export const arrivalId = (index: number) => `arrive:${index}`;

/** An arrival is marked from the turn it is due. */
export const isDue = (a: Arrival, battle: BattleState) => a.turn <= battle.turn;

/**
 * How many of an arrival's size points came from missed doses. Arrival sizes already include the
 * bonus (capped), so this is the missed-dose count limited to what the size can hold.
 */
export function arrivalBonus(battle: BattleState, a: Arrival): number {
  return Math.max(0, Math.min(battle.missedDoses ?? 0, a.size - 1));
}

export interface NextArrival {
  /** Terse, for the stats row. */
  readonly text: string;
  /** Full sentence, for aria-labels. */
  readonly aria: string;
}

/** "Next: 1 Staph, turn 3" for the soonest group, or "Next: nothing". */
export function nextArrival(battle: BattleState): NextArrival {
  if (battle.arrivals.length === 0) {
    return { text: "Next: nothing", aria: "No more germs are due to arrive." };
  }
  const soonest = Math.min(...battle.arrivals.map((a) => a.turn));
  const when = Math.max(soonest, battle.turn);
  const group = battle.arrivals.filter(
    (a) => Math.max(a.turn, battle.turn) === when,
  );
  const count = new Map<PathogenKindId, number>();
  for (const a of group) count.set(a.kind, (count.get(a.kind) ?? 0) + 1);
  const short = [...count].map(([k, n]) => `${n} ${SHORT_NAME[k]}`).join(" + ");
  const full = [...count]
    .map(([k, n]) => `${n} ${PATHOGEN_KINDS[k].organism}`)
    .join(" and ");
  const where = when <= battle.turn ? "this turn" : `turn ${when}`;
  return {
    text: `Next: ${short}, ${where}`,
    aria: `Next to arrive: ${full}, ${when <= battle.turn ? "at the end of this turn" : `on turn ${when}`}.`,
  };
}

/** The "Turn 3 of 6" line. */
export function turnText(battle: {
  turn: number;
  maxTurns: number;
  kind: string;
}): { text: string; aria: string } {
  const t = Math.min(battle.turn, battle.maxTurns);
  const skirmish = battle.kind === "skirmish";
  return {
    text: `${skirmish ? "Skirmish · " : ""}Turn ${t} of ${battle.maxTurns}`,
    aria: `${skirmish ? "Skirmish, " : ""}turn ${t} of ${battle.maxTurns}`,
  };
}

/** What the board draws for one incoming mark. */
export interface ArrivalMarkModel {
  readonly kind: PathogenKindId;
  readonly size: number;
  readonly bonus: number;
  readonly blocked: boolean;
  /** Pill text on the board, e.g. "Staph 2 +1". */
  readonly badge: string;
  /** Word under the ring: "arrives" or "blocked". */
  readonly caption: string;
}

export function arrivalMarkModel(
  battle: BattleState,
  mark: TelegraphMark,
): ArrivalMarkModel | null {
  if (mark.type !== "arrive" || !mark.kind) return null;
  const index = Number(mark.pathogenId.slice("arrive:".length));
  const a = battle.arrivals[index];
  const bonus = a ? arrivalBonus(battle, a) : 0;
  const blocked = mark.blockedBy !== null;
  return {
    kind: mark.kind,
    size: mark.sizeAfter,
    bonus,
    blocked,
    badge: `${SHORT_NAME[mark.kind]} ${mark.sizeAfter}${bonus > 0 ? ` +${bonus}` : ""}`,
    caption: blocked ? "blocked" : "arrives",
  };
}

/** The info card lines for an incoming mark (index into BattleState.arrivals). */
export function arrivalCard(
  battle: BattleState,
  mark: TelegraphMark,
): { title: string; sub: string; lines: string[] } | null {
  const m = arrivalMarkModel(battle, mark);
  if (!m) return null;
  const def = pathogenKind(m.kind);
  const index = Number(mark.pathogenId.slice("arrive:".length));
  const a = battle.arrivals[index];
  const turn = Math.max(a?.turn ?? battle.turn, battle.turn);
  const lines = [
    `Size ${m.size}`,
    turn <= battle.turn
      ? "Arrives at the end of this turn."
      : `Arrives on turn ${turn}.`,
  ];
  if (m.bonus > 0) {
    lines.push(
      `+${m.bonus} size from missed doses. Medication keeps new germs smaller.`,
    );
  }
  if (m.blocked) {
    lines.push(
      def.wall === "leaky"
        ? `${mark.blockedBy} is standing on this door: the germ would meet it there and be cleared.`
        : `${mark.blockedBy} is standing on this door: the germ is held off and tries again next turn at a free door.`,
    );
  } else {
    lines.push(`Stand a swarm on ${xy(mark.from)} to meet it at the door.`);
  }
  return {
    title: `Incoming ${def.label}`,
    sub: `${def.organism} at door ${xy(mark.from)}`,
    lines,
  };
}

/** Whether the board currently shows any incoming mark, and whether any is blocked. */
export function incomingKey(battle: BattleState): {
  incoming: boolean;
  blocked: boolean;
} {
  const due = battle.arrivals.filter((a) => isDue(a, battle));
  return {
    incoming: due.length > 0,
    blocked: due.some((a) =>
      battle.swarms.some((s) => s.at.x === a.door.x && s.at.y === a.door.y),
    ),
  };
}
